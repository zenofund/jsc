import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    // Administrative roles must still match the endpoint's explicit role list.

    const normalizeRole = (role: any) => {
      const r = String(role || '').toLowerCase();
      if (r === 'reviewer') return 'checking';
      if (r === 'approver') return 'cpo';
      return r;
    };
    
    const hasRole = !requiredRoles || requiredRoles.some((role) =>
      normalizeRole(user.role) === normalizeRole(role)
    );
    const userPermissions = Array.isArray(user.permissions)
      ? user.permissions.map((permission: unknown) => String(permission))
      : [];
    const hasPermissions = !requiredPermissions ||
      requiredPermissions.every((permission) => userPermissions.includes(permission));
    
    if (!hasRole || !hasPermissions) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
