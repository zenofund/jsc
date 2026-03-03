import { IsOptional, IsString, IsNumber, IsEnum, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryStaffDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['active', 'on_leave', 'suspended', 'retired', 'terminated'] })
  @IsEnum(['active', 'on_leave', 'suspended', 'retired', 'terminated'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ enum: ['Permanent', 'Contract', 'Temporary', 'Probation'] })
  @IsEnum(['Permanent', 'Contract', 'Temporary', 'Probation'])
  @IsOptional()
  employmentType?: string;
}
