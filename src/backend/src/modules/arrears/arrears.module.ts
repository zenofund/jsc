import { Module } from '@nestjs/common';
import { ArrearsController } from './arrears.controller';
import { ArrearsService } from './arrears.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ArrearsController],
  providers: [ArrearsService],
  exports: [ArrearsService],
})
export class ArrearsModule {}
