import { IsNotEmpty, IsNumber, IsDate, IsOptional, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromoteStaffDto {
  @ApiProperty({ description: 'Effective date of promotion' })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  promotionDate: Date;

  @ApiProperty({ description: 'New grade level after promotion' })
  @IsNumber()
  @IsNotEmpty()
  newGradeLevel: number;

  @ApiProperty({ description: 'New step after promotion' })
  @IsNumber()
  @IsNotEmpty()
  newStep: number;

  @ApiProperty({ description: 'New basic salary after promotion' })
  @IsNumber()
  @IsNotEmpty()
  newBasicSalary: number;

  @ApiPropertyOptional({ 
    enum: ['regular', 'acting', 'conversion', 'accelerated'],
    description: 'Type of promotion',
    default: 'regular'
  })
  @IsEnum(['regular', 'acting', 'conversion', 'accelerated'])
  @IsOptional()
  promotionType?: string;

  @ApiPropertyOptional({ description: 'Additional remarks about the promotion' })
  @IsString()
  @IsOptional()
  remarks?: string;
}
