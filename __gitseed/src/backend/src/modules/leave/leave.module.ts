import { Module, forwardRef } from '@nestjs/common';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { DatabaseModule } from '@common/database/database.module';
import { EmailModule } from '@modules/email/email.module';
import { WorkflowModule } from '@modules/workflow/workflow.module';
import { AuditModule } from '@modules/audit/audit.module';
import { NotificationsModule } from '@modules/notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule, 
    EmailModule,
    AuditModule,
    NotificationsModule,
    forwardRef(() => WorkflowModule),
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}