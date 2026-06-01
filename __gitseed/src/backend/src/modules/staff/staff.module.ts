import { Module, forwardRef } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { EmailModule } from '@modules/email/email.module';
import { SalaryStructuresModule } from '@modules/salary-structures/salary-structures.module';
import { AllowancesModule } from '@modules/allowances/allowances.module';
import { DeductionsModule } from '@modules/deductions/deductions.module';
import { AuditModule } from '@modules/audit/audit.module';

import { DepartmentsModule } from '@modules/departments/departments.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';
import { SettingsModule } from '@modules/settings/settings.module';

@Module({
  imports: [
    EmailModule,
    forwardRef(() => SalaryStructuresModule),
    AllowancesModule,
    DeductionsModule,
    AuditModule,
    NotificationsModule,
    DepartmentsModule,
    SettingsModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}