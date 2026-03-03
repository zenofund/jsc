import { IsNotEmpty, IsString, IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePayrollBatchDto {
  @ApiProperty({ example: '2025-01', description: 'Payroll month in YYYY-MM format' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Payroll month must be in YYYY-MM format' })
  payrollMonth: string;

  @ApiProperty({ example: '2025-01-01', description: 'Period start date' })
  @IsDateString()
  @IsNotEmpty()
  periodStart: string;

  @ApiProperty({ example: '2025-01-31', description: 'Period end date' })
  @IsDateString()
  @IsNotEmpty()
  periodEnd: string;
}
