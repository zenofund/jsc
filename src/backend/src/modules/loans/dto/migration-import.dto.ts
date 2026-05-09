import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LoanStatus } from './loan.dto';

export class MigrationLoanRowDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  staffNumber?: string;

  @IsOptional()
  @IsString()
  loanTypeId?: string;

  @IsOptional()
  @IsString()
  loanTypeCode?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsNumber()
  @Min(0)
  principalAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountRepaid?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outstandingBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRate?: number;

  @IsNumber()
  @Min(1)
  tenureMonths: number;

  @IsOptional()
  @IsString()
  disbursementDate?: string;

  @IsOptional()
  @IsString()
  startMonth?: string;

  @IsOptional()
  @IsString()
  endMonth?: string;

  @IsOptional()
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @IsOptional()
  @IsString()
  disbursementMethod?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  legacyReference?: string;
}

export class MigrationLoanRepaymentRowDto {
  @IsOptional()
  @IsString()
  disbursementNumber?: string;

  @IsOptional()
  @IsString()
  legacyReference?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  staffNumber?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  month?: string;
}

export class LoanMigrationImportDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationLoanRowDto)
  loans?: MigrationLoanRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationLoanRepaymentRowDto)
  repayments?: MigrationLoanRepaymentRowDto[];
}
