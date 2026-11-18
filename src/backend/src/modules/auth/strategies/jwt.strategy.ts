import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { DatabaseService } from '@common/database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const settingsRow = await this.databaseService.queryOne(
      `SELECT value FROM system_settings WHERE key = 'general_settings'`,
    );
    const singleSessionOnly = Boolean(settingsRow?.value?.single_session_only);

    const userRow = await this.databaseService.queryOne(
      `SELECT u.status, u.role, u.staff_id,
              ARRAY(
                SELECT assigned.permission_key
                FROM UNNEST(COALESCE(u.permissions, '{}'::TEXT[])) AS assigned(permission_key)
                JOIN app_permissions ap
                  ON ap.permission_key = assigned.permission_key
                 AND ap.is_active = TRUE
                ORDER BY assigned.permission_key
              ) AS permissions,
              u.current_session_id
       FROM users u
       WHERE u.id = $1`,
      [payload.sub],
    );

    if (!userRow || String(userRow.status || '').toLowerCase() !== 'active') {
      throw new UnauthorizedException('Session expired. Please login again.');
    }

    if (singleSessionOnly) {
      if (!payload?.sid) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }

      if (String(userRow.current_session_id || '') !== String(payload.sid || '')) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: userRow.role || payload.role,
      permissions: Array.isArray(userRow.permissions)
        ? userRow.permissions.map((permission: unknown) => String(permission))
        : [],
      departmentId: payload.departmentId,
      staffId: userRow.staff_id,
    };
  }
}
