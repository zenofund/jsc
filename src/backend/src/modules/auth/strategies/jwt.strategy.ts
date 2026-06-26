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

    if (singleSessionOnly) {
      if (!payload?.sid) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }

      const userRow = await this.databaseService.queryOne(
        `SELECT status, current_session_id
         FROM users
         WHERE id = $1`,
        [payload.sub],
      );

      if (!userRow || String(userRow.status || '').toLowerCase() !== 'active') {
        throw new UnauthorizedException('Session expired. Please login again.');
      }

      if (String(userRow.current_session_id || '') !== String(payload.sid || '')) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
      departmentId: payload.departmentId,
      staffId: payload.staffId,
    };
  }
}
