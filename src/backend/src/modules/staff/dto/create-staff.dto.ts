import { IsNotEmpty, IsString, IsEmail, IsOptional, IsDate, IsNumber, IsEnum, IsUUID, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';

export class CreateStaffDto {
  @ApiProperty({ description: 'FILE NO / Staff Number' })
  @IsString()
  @IsNotEmpty()
  staffNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  dateOfBirth: Date;

  @ApiProperty({ enum: ['male', 'female'] })
  @IsEnum(['male', 'female'])
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ enum: ['single', 'married', 'divorced', 'widowed'] })
  @IsEnum(['single', 'married', 'divorced', 'widowed'])
  @IsOptional()
  maritalStatus?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stateOfOrigin: string;

  @IsString()
  @IsNotEmpty()
  lgaOfOrigin: string;

  @ApiProperty({ enum: ['NC', 'NE', 'NW', 'SS', 'SW', 'SE'] })
  @IsEnum(['NC', 'NE', 'NW', 'SS', 'SW', 'SE'])
  @IsNotEmpty()
  zone: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  qualification: string;

  @ApiPropertyOptional({ default: 'Nigerian' })
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cadre?: string;

  @ApiPropertyOptional({ enum: ['Permanent', 'Contract', 'Temporary', 'Probation', 'Casual'] })
  @IsEnum(['Permanent', 'Contract', 'Temporary', 'Probation', 'Casual'])
  @IsOptional()
  employmentType?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  employmentDate: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  exitDate: Date;

  @ApiPropertyOptional({ enum: ['resignation', 'termination', 'retirement', 'death'] })
  @IsEnum(['resignation', 'termination', 'retirement', 'death'])
  @IsOptional()
  exitReason?: string;

  @ApiPropertyOptional({ description: 'Effective date of promotion for mid-month proration calculation' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  promotionDate?: Date;

  @ApiPropertyOptional({ description: 'Grade level before current promotion (for split-period calculation)' })
  @IsNumber()
  @IsOptional()
  previousGradeLevel?: number;

  @ApiPropertyOptional({ description: 'Step before current promotion (for split-period calculation)' })
  @IsNumber()
  @IsOptional()
  previousStep?: number;

  @ApiPropertyOptional({ description: 'Basic salary before current promotion (for split-period calculation)' })
  @IsNumber()
  @IsOptional()
  previousBasicSalary?: number;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  confirmationDate: Date;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  postOnFirstAppointment: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  presentAppointment: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  dateOfPresentAppointment: Date;

  @ApiPropertyOptional()
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  retirementDate?: Date;

  @ApiProperty()
  @IsString()
  @Matches(/^(?:\d+|[A-Za-z]+\d+)$/)
  @IsNotEmpty()
  gradeLevel: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  step: number;

  @ApiPropertyOptional({ 
    description: 'DEPRECATED: Basic salary is now automatically fetched from salary structure based on grade_level and step. This field is kept for backward compatibility only.'
  })
  @IsNumber()
  @IsOptional()
  currentBasicSalary?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ description: 'CBN bank code (sort code)' })
  @IsString()
  @Matches(/^\d+$/)
  @IsOptional()
  bankCode?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accountName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bvn?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  pensionPin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nhfNumber?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nokName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nokRelationship?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nokPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nokAddress?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'on_leave', 'retired', 'terminated', 'resigned', 'secondment', 'interdiction'] })
  @IsEnum(['active', 'suspended', 'on_leave', 'retired', 'terminated', 'resigned', 'secondment', 'interdiction'])
  @IsOptional()
  status?: string;
}

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
