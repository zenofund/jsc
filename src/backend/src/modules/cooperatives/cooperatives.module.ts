import { Module } from '@nestjs/common';
import { CooperativesController } from './cooperatives.controller';
import { CooperativesService } from './cooperatives.service';
import { DatabaseModule } from '@common/database/database.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [CooperativesController],
  providers: [CooperativesService],
  exports: [CooperativesService],
})
export class CooperativesModule {}
