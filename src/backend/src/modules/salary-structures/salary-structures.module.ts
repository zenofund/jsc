import { Module, forwardRef } from '@nestjs/common';
import { SalaryStructuresController } from './salary-structures.controller';
import { SalaryStructuresService } from './salary-structures.service';
import { SalaryLookupService } from './salary-lookup.service';
import { StaffModule } from '@modules/staff/staff.module';

@Module({
  imports: [forwardRef(() => StaffModule)],
  controllers: [SalaryStructuresController],
  providers: [SalaryStructuresService, SalaryLookupService],
  exports: [SalaryStructuresService, SalaryLookupService],
})
export class SalaryStructuresModule {}