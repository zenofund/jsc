import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';

export enum CooperativeType {
  SAVINGS = 'savings',
  CREDIT = 'credit',
  MULTI_PURPOSE = 'multi_purpose',
  THRIFT = 'thrift',
}

export class CreateCooperativeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type: CooperativeType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  registrationFee: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyContribution: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  interestRate?: number;

  @IsString()
  @IsOptional()
  registration_number?: string;

  @IsString()
  @IsOptional()
  date_established?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  share_capital_value?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimum_shares?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  interest_rate_on_loans?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maximum_loan_multiplier?: number;

  @IsString()
  @IsOptional()
  meeting_schedule?: string;

  @IsString()
  @IsOptional()
  chairman_name?: string;

  @IsString()
  @IsOptional()
  secretary_name?: string;

  @IsString()
  @IsOptional()
  treasurer_name?: string;

  @IsString()
  @IsOptional()
  contact_email?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsString()
  @IsOptional()
  bank_name?: string;

  @IsString()
  @IsOptional()
  bank_account_number?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_contribution_required?: number;

  @IsOptional()
  @IsString()
  cooperative_type?: string;

  @IsOptional()
  auto_deduct_contribution?: boolean;
}
