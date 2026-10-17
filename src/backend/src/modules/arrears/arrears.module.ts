import { Module } from '@nestjs/common';
import { ArrearsController } from './arrears.controller';
import { ArrearsService } from './arrears.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SalaryStructuresModule } from '../salary-structures/salary-structures.module';
import { TaxModule } from '@common/tax/tax.module';

@Module({
  imports: [NotificationsModule, SalaryStructuresModule, TaxModule],
  controllers: [ArrearsController],
  providers: [ArrearsService],
  exports: [ArrearsService],
})
export class ArrearsModule {}
