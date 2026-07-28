import { Module } from '@nestjs/common';
import { CooperativesController } from './cooperatives.controller';
import { CooperativesService } from './cooperatives.service';
import { DatabaseModule } from '@common/database/database.module';
import { FeatureToggleGuard } from '@common/guards/feature-toggle.guard';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [DatabaseModule, AuditModule, SettingsModule],
  controllers: [CooperativesController],
  providers: [CooperativesService, FeatureToggleGuard],
  exports: [CooperativesService],
})
export class CooperativesModule {}
