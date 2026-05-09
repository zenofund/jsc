import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Observable, of, throwError, from } from 'rxjs';
import { catchError, tap, switchMap } from 'rxjs/operators';
import { DatabaseService } from '../database/database.service';
import { Request } from 'express';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly db: DatabaseService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = request.headers['idempotency-key'] as string;
    const method = request.method;
    const path = request.path;
    const user = (request as any).user;

    // Only apply to state-changing methods if key is present
    if (!idempotencyKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    this.logger.log(`Checking idempotency key: ${idempotencyKey} for ${method} ${path}`);

    // Check if key exists
    const existingKey = await this.db.queryOne(
      'SELECT * FROM idempotency_keys WHERE key = $1',
      [idempotencyKey]
    );

    if (existingKey) {
      if (existingKey.status === 'COMPLETED') {
        // If the cached response was a 404, we should allow retry because it might be a temporary error (e.g. race condition)
        // or a logic error that has since been fixed.
        if (existingKey.response_code === 404) {
             this.logger.log(`Idempotency hit: Cached response was 404 for ${idempotencyKey}. Allowing retry.`);
             await this.db.query(
                'UPDATE idempotency_keys SET status = $1, updated_at = NOW() WHERE key = $2',
                ['PENDING', idempotencyKey]
             );
        } else {
            this.logger.log(`Idempotency hit: Returning cached response for ${idempotencyKey}`);
            return of(existingKey.response_body);
        }
      } else if (existingKey.status === 'PENDING') {
        // Check if the pending request is stale (e.g. > 1 minute old)
        const createdAt = new Date(existingKey.created_at);
        const now = new Date();
        const diff = now.getTime() - createdAt.getTime();
        
        if (diff > 60000) { // 1 minute
            this.logger.warn(`Idempotency key ${idempotencyKey} is stale (PENDING for > 60s). Resetting.`);
            await this.db.query(
                'UPDATE idempotency_keys SET status = $1, updated_at = NOW() WHERE key = $2',
                ['PENDING', idempotencyKey]
            );
            // Continue to process
        } else {
            this.logger.warn(`Idempotency conflict: Request already in progress for ${idempotencyKey}`);
            throw new ConflictException('This operation is currently in progress. Please wait.');
        }
      } else {
        // FAILED status - allow retry
        this.logger.log(`Retrying failed idempotency key: ${idempotencyKey}`);
        // We update to PENDING to lock it again
        await this.db.query(
          'UPDATE idempotency_keys SET status = $1, updated_at = NOW() WHERE key = $2',
          ['PENDING', idempotencyKey]
        );
      }
    } else {
      // Create new key
      await this.db.query(
        'INSERT INTO idempotency_keys (key, path, method, status, user_id) VALUES ($1, $2, $3, $4, $5)',
        [idempotencyKey, path, method, 'PENDING', user?.id || null]
      );
    }

    return next.handle().pipe(
      tap(async (response) => {
        // On success, update to COMPLETED
        try {
            await this.db.query(
            'UPDATE idempotency_keys SET status = $1, response_code = $2, response_body = $3, updated_at = NOW() WHERE key = $4',
            ['COMPLETED', 200, response, idempotencyKey]
            );
        } catch (dbError) {
            this.logger.error(`Failed to update idempotency key to COMPLETED: ${dbError.message}`);
        }
      }),
      catchError((error) => {
        // On error, update to FAILED
        const status = error instanceof HttpException ? error.getStatus() : 500;
        const message = error.response || error.message || 'Unknown error';
        
        this.logger.error(`Request failed for key ${idempotencyKey}: ${JSON.stringify(message)}`);

        return from(
            this.db.query(
            'UPDATE idempotency_keys SET status = $1, response_code = $2, response_body = $3, updated_at = NOW() WHERE key = $4',
            ['FAILED', status, { message }, idempotencyKey]
            )
        ).pipe(
            switchMap(() => throwError(() => error))
        );
      }),
    );
  }
}
