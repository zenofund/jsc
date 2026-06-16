import { Module } from '@nestjs/common';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { DatabaseModule } from '@common/database/database.module';
import { EmailModule } from '@modules/email/email.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { AuditModule } from '@modules/audit/audit.module';

@Module({
  imports: [DatabaseModule, EmailModule, NotificationsModule, AuditModule],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}