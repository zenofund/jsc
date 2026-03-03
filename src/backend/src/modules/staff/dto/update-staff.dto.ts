import { PartialType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @ApiPropertyOptional({ enum: ['Permanent', 'Contract', 'Temporary', 'Probation', 'Casual'] })
  @IsEnum(['Permanent', 'Contract', 'Temporary', 'Probation', 'Casual'])
  @IsOptional()
  employmentType?: string;
}
