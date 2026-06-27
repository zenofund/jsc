import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { DatabaseService } from '@common/database/database.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { evaluateGeoFencingPolicy } from '@modules/auth/geo-fencing.util';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const settingsRow = await this.databaseService.queryOne(
      `SELECT value FROM system_settings WHERE key = 'general_settings'`,
    );

    const policyResult = evaluateGeoFencingPolicy({
      settings: settingsRow?.value || {},
      requestHeaders: request?.headers,
      remoteIp: request?.ip || request?.socket?.remoteAddress || '',
    });

    if (!policyResult.allowed) {
      throw new UnauthorizedException(policyResult.message || 'Access denied: you must be within the office perimeter.');
    }

    return true;
  }
}
