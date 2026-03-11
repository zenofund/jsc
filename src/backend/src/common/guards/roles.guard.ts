import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    // Allow admin and super_admin to access all resources
    if (user.role && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'super_admin')) {
      return true;
    }

    const normalizeRole = (role: any) => {
      const r = String(role || '').toLowerCase();
      if (r === 'reviewer') return 'checking';
      if (r === 'approver') return 'cpo';
      return r;
    };
    
    const hasRole = requiredRoles.some((role) => 
      normalizeRole(user.role) === normalizeRole(role)
    );
    
    if (!hasRole) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
