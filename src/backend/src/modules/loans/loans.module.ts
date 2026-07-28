import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { DatabaseModule } from '@common/database/database.module';
import { FeatureToggleGuard } from '@common/guards/feature-toggle.guard';
import { EmailModule } from '@modules/email/email.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { AuditModule } from '@modules/audit/audit.module';
import { SettingsModule } from '@modules/settings/settings.module';

@Module({
  imports: [DatabaseModule, EmailModule, NotificationsModule, AuditModule, SettingsModule],
  controllers: [LoansController],
  providers: [LoansService, FeatureToggleGuard],
  exports: [LoansService],
})
export class LoansModule {}
