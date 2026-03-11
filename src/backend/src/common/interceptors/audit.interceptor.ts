import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = (req?.method || '').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }
    const url: string = req?.originalUrl || req?.url || '';
    const lowerUrl = (url || '').toLowerCase();
    if (
      method === 'POST' &&
      lowerUrl.includes('/payroll/batches/') &&
      (lowerUrl.endsWith('/approve') || lowerUrl.endsWith('/submit'))
    ) {
      return next.handle();
    }
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
          newValues = typeof response === 'object' ? response : undefined;
        } else if (action === AuditAction.UPDATE) {
          oldValues = typeof body === 'object' ? body : undefined;
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
