import { Module } from '@nestjs/common';
import { PayeCalculatorService } from './paye-calculator.service';

@Module({
  providers: [PayeCalculatorService],
  exports: [PayeCalculatorService],
})
export class TaxModule {}
