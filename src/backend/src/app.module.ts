import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Common modules
import { DatabaseModule } from './common/database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { StaffModule } from './modules/staff/staff.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AllowancesModule } from './modules/allowances/allowances.module';
import { DeductionsModule } from './modules/deductions/deductions.module';
import { SalaryStructuresModule } from './modules/salary-structures/salary-structures.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { CooperativesModule } from './modules/cooperatives/cooperatives.module';
import { LoansModule } from './modules/loans/loans.module';
import { LeaveModule } from './modules/leave/leave.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EmailModule } from './modules/email/email.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';
import { BankModule } from './modules/bank/bank.module';
import { UsersModule } from './modules/users/users.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ArrearsModule } from './modules/arrears/arrears.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    DatabaseModule,

    // Feature modules
    AuthModule,
    StaffModule,
    DepartmentsModule,
    PayrollModule,
    AllowancesModule,
    DeductionsModule,
    SalaryStructuresModule,
    CooperativesModule,
    LoansModule,
    LeaveModule,
    NotificationsModule,
    AuditModule,
    ReportsModule,
    EmailModule,
    ExternalApiModule,
    BankModule,
    UsersModule,
    PromotionsModule,
    ArrearsModule,
    SettingsModule,
    WorkflowModule,
    HealthModule,
  ],
  providers: [
    // Global JWT guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Idempotency interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}