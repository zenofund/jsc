import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum LoanStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISBURSED = 'disbursed',
  COMPLETED = 'completed',
  DEFAULTED = 'defaulted',
}

export class CreateLoanTypeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  maxAmount: number;

  @IsNumber()
  @Min(0)
  interestRate: number;

  @IsNumber()
  @Min(1)
  maxTenureMonths: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minServiceYears?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSalaryPercentage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredGuarantors?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minGuarantors?: number;

  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @IsOptional()
  @IsString()
  eligibilityCriteria?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  requiresGuarantors?: boolean;
}
export class UpdateLoanTypeDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  interestRate?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTenureMonths?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minServiceYears?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxSalaryPercentage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  requiredGuarantors?: number;

  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @IsOptional()
  @IsString()
  eligibilityCriteria?: string;

  @IsOptional()
  @IsString()
  status?: string;

  // Handling boolean to number conversion or accepting boolean if logic changes
  // For now, let's make requiresGuarantors boolean since frontend sends boolean
  @IsOptional()
  requiresGuarantors?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minGuarantors?: number;
}

export class GuarantorDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class CreateLoanApplicationDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  loanTypeId: string;

  @IsNumber()
  @Min(0)
  requestedAmount: number;

  @IsNumber()
  @Min(1)
  tenureMonths: number;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuarantorDto)
  guarantors: GuarantorDto[];
}

export class ApproveLoanDto {
  @IsNumber()
  @Min(0)
  approvedAmount: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class DisburseLoanDto {
  @IsString()
  @IsNotEmpty()
  loanApplicationId: string;

  @IsDateString()
  disbursementDate: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  payrollBatchId?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RecordRepaymentDto {
  @IsString()
  @IsNotEmpty()
  disbursementId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  month: string; // Format: YYYY-MM

  @IsString()
  @IsOptional()
  payrollBatchId?: string;
}

export class UpdateLoanApplicationDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  requestedAmount?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  tenureMonths?: number;

  @IsString()
  @IsOptional()
  purpose?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class CreateGuarantorDto {
  @IsString()
  @IsNotEmpty()
  loanApplicationId: string;

  @IsString()
  @IsNotEmpty()
  guarantorStaffId: string;

  @IsString()
  @IsOptional()
  relationship?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class UpdateGuarantorDto {
  @IsString()
  @IsOptional()
  consentStatus?: string;

  @IsString()
  @IsOptional()
  consentComments?: string;

  @IsDateString()
  @IsOptional()
  consentDate?: string;
}