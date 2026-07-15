import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skipAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipAudit) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const method = (req?.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }
    const url: string = req?.originalUrl || req?.url || '';
    const lowerUrl = (url || '').toLowerCase();

    const parts = url.replace(/^\/+/, '').split('/');
    let entity = parts[0] || '';
    if (entity === 'api' && parts[1] && parts[2]) {
      entity = parts[2];
    }
    const userId = req?.user?.userId || null;
    const ipAddress = req?.ip || null;
    const params = req?.params || {};
    const body = req?.body || null;
    let action: AuditAction;
    if (method === 'POST' && lowerUrl.includes('/auth/login')) {
      action = AuditAction.LOGIN;
    } else if (method === 'POST' && lowerUrl.includes('/auth/logout')) {
      action = AuditAction.LOGOUT;
    } else if (method === 'DELETE') {
      action = AuditAction.DELETE;
    } else if (method === 'POST') {
      action = AuditAction.CREATE;
    } else {
      action = AuditAction.UPDATE;
    }

    return next.handle().pipe(
      tap(async (response) => {
        const entityId =
          (params?.id as string) ||
          (typeof response === 'object' && response && (response.id as string)) ||
          null;
        let oldValues: Record<string, any> | undefined = undefined;
        let newValues: Record<string, any> | undefined = undefined;
        if (action === AuditAction.CREATE) {
          if (typeof body === 'object' && body) {
            newValues = {
              ...body,
              ...(typeof response === 'object' && response ? response : {}),
            };
          } else {
            newValues = typeof response === 'object' ? response : undefined;
          }
        } else if (action === AuditAction.UPDATE) {
          oldValues = undefined; // We cannot reliably know old values in a generic interceptor
          newValues = typeof response === 'object' ? response : undefined;
        } else if (action === AuditAction.DELETE) {
          oldValues = entityId ? { id: entityId } : undefined;
        }
        await this.auditService.log({
          userId: userId || undefined,
          action,
          entity: entity || 'unknown',
          entityId: entityId || undefined,
          description: `${method} ${url}`,
          oldValues,
          newValues,
          ipAddress: ipAddress || undefined,
        });
      }),
    );
  }
}
