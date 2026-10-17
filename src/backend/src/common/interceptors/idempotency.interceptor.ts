import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { createHash } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { Request, Response } from 'express';

const FALLBACK_REQUEST_HASH_MARKER = '::idempotency-hash::';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private requestHashColumnAvailable: boolean | null = null;

  constructor(private readonly db: DatabaseService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: any }>();
    const response = http.getResponse<Response>();
    const rawKey = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    const method = request.method.toUpperCase();
    const path = request.path;

    if (!idempotencyKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const userId = request.user?.userId || request.user?.id || null;
    const requestHash = createHash('sha256')
      .update(JSON.stringify([method, request.originalUrl, userId, request.body ?? null]))
      .digest('hex');

    // The unique key insert is the atomic claim. A concurrent retry either
    // claims the key or observes the existing PENDING/COMPLETED record.
    let claimed: any;
    if (this.requestHashColumnAvailable !== false) {
      try {
        claimed = await this.db.queryOne(
          `INSERT INTO idempotency_keys (key, path, method, status, user_id, request_hash)
           VALUES ($1, $2, $3, 'PENDING', $4, $5)
           ON CONFLICT (key) DO NOTHING
           RETURNING id`,
          [idempotencyKey, path, method, userId, requestHash],
        );
        this.requestHashColumnAvailable = true;
      } catch (error: any) {
        if (error.code !== '42703') throw error;
        // Keep API writes working while a deployment is waiting for migration 069.
        this.requestHashColumnAvailable = false;
      }
    }
    if (this.requestHashColumnAvailable === false) {
      claimed = await this.db.queryOne(
        `INSERT INTO idempotency_keys (key, path, method, status, user_id)
         VALUES ($1, $2, $3, 'PENDING', $4)
         ON CONFLICT (key) DO NOTHING
         RETURNING id`,
        [idempotencyKey, `${path}${FALLBACK_REQUEST_HASH_MARKER}${requestHash}`, method, userId],
      );
    }

    if (!claimed) {
      let existing: any;
      if (this.requestHashColumnAvailable !== false) {
        try {
          existing = await this.db.queryOne<any>(
            'SELECT path, method, status, response_code, response_body, user_id, request_hash FROM idempotency_keys WHERE key = $1',
            [idempotencyKey],
          );
          this.requestHashColumnAvailable = true;
        } catch (error: any) {
          if (error.code !== '42703') throw error;
          this.requestHashColumnAvailable = false;
        }
      }
      if (this.requestHashColumnAvailable === false) {
        existing = await this.db.queryOne<any>(
          'SELECT path, method, status, response_code, response_body, user_id FROM idempotency_keys WHERE key = $1',
          [idempotencyKey],
        );
      }

      if (!existing) {
        throw new ConflictException('This request is already being processed. Retry it shortly.');
      }

      const fallbackMarkerIndex = String(existing.path || '').lastIndexOf(FALLBACK_REQUEST_HASH_MARKER);
      const storedPath = fallbackMarkerIndex < 0
        ? existing.path
        : existing.path.slice(0, fallbackMarkerIndex);
      const fallbackHash = fallbackMarkerIndex < 0
        ? null
        : existing.path.slice(fallbackMarkerIndex + FALLBACK_REQUEST_HASH_MARKER.length);
      const storedRequestHash = existing.request_hash || fallbackHash;
      const sameOwner = !existing.user_id || !userId || existing.user_id === userId;
      const sameRequest = storedPath === path
        && existing.method === method
        && sameOwner
        && (!storedRequestHash || storedRequestHash === requestHash);
      if (!sameRequest) {
        throw new ConflictException('This idempotency key was already used for a different request.');
      }

      if (existing.status === 'PENDING') {
        // Never expire an in-flight key based only on age: a slow request could
        // still commit after a stale-key reset and create the same record twice.
        throw new ConflictException('This operation is still processing. Retry it shortly.');
      }

      const responseCode = existing.response_code || 200;
      if (responseCode >= 400) {
        throw new HttpException(existing.response_body ?? { statusCode: responseCode, message: 'Request failed' }, responseCode);
      }
      response.status(responseCode);
      return of(existing.response_body ?? null);
    }

    return next.handle().pipe(
      concatMap(async (body) => {
        try {
          await this.db.query(
            `UPDATE idempotency_keys
             SET status = 'COMPLETED', response_code = $1, response_body = $2, updated_at = NOW()
             WHERE key = $3`,
            [response.statusCode || 200, body ?? null, idempotencyKey],
          );
        } catch (error: any) {
          // Keeping the row PENDING is safer than allowing a retry to repeat a
          // write whose response could not be recorded.
          this.logger.error(`Could not cache successful response for idempotency key: ${error.message}`);
        }
        return body;
      }),
      catchError((error) => {
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;
        const errorBody = error instanceof HttpException
          ? error.getResponse()
          : { statusCode, message: 'Internal server error' };

        // Cache errors too. The server cannot know whether a handler failed
        // before or after an external side effect, so replaying the same result
        // is safer than blindly executing the write again.
        return from(
          this.db.query(
            `UPDATE idempotency_keys
             SET status = 'COMPLETED', response_code = $1, response_body = $2, updated_at = NOW()
             WHERE key = $3`,
            [statusCode, errorBody, idempotencyKey],
          ),
        ).pipe(
          catchError((cacheError: any) => {
            this.logger.error(`Could not cache error response for idempotency key: ${cacheError.message}`);
            return of(null);
          }),
          concatMap(() => throwError(() => error)),
        );
      }),
    );
  }
}
