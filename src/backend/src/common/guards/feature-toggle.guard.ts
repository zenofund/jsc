import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_FEATURE_KEY, type AppFeatureKey } from '../decorators/require-feature.decorator';
import { SettingsService } from '@modules/settings/settings.service';

@Injectable()
export class FeatureToggleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settingsService: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<AppFeatureKey | undefined>(REQUIRED_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!featureKey) {
      return true;
    }

    const enabled = await this.settingsService.isFeatureEnabled(featureKey);
    if (enabled) {
      return true;
    }

    const featureLabel = featureKey === 'loan_management' ? 'Loan management' : 'Cooperative management';
    throw new ForbiddenException(`${featureLabel} is currently disabled by admin settings.`);
  }
}
