import { Module } from '@nestjs/common';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { StaffModule } from '../staff/staff.module';
import { EmailModule } from '@modules/email/email.module';
import { ExternalApiModule } from '@modules/external-api/external-api.module';
import { SalaryStructuresModule } from '@modules/salary-structures/salary-structures.module';
import { AuditModule } from '@modules/audit/audit.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { CooperativesModule } from '@modules/cooperatives/cooperatives.module';

@Module({
  imports: [
    StaffModule, 
    EmailModule, 
    ExternalApiModule, 
    SalaryStructuresModule, 
    AuditModule, 
    NotificationsModule,
    CooperativesModule
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}