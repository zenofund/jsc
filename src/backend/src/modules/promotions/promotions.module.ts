import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { SalaryStructuresModule } from '../salary-structures/salary-structures.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [SalaryStructuresModule, NotificationsModule, AuditModule],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
