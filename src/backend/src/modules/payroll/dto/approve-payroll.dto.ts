import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovePayrollDto {
  @ApiProperty({ enum: ['approved', 'rejected'], example: 'approved' })
  @IsEnum(['approved', 'rejected'])
  @IsNotEmpty()
  action: 'approved' | 'rejected';

  @ApiPropertyOptional({ example: 'Verified and approved' })
  @IsString()
  @IsOptional()
  comments?: string;
}
