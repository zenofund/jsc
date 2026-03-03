import { OmitType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BulkCreateStaffDto extends OmitType(CreateStaffDto, ['departmentId'] as const) {
  @ApiPropertyOptional({ description: 'Department ID (UUID)' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Department Name (if ID is not provided)' })
  @IsString()
  @IsOptional()
  departmentName?: string;
}