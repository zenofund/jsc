import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class RecordContributionDto {
  @IsString()
  @IsNotEmpty()
  cooperativeId: string;

  @IsString()
  @IsNotEmpty()
  memberId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsNotEmpty()
  month: string; // Format: YYYY-MM

  @IsString()
  @IsOptional()
  payrollBatchId?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  contributionType?: string;

  @IsString()
  @IsOptional()
  contribution_month?: string;

  @IsString()
  @IsOptional()
  contribution_type?: string;

  @IsString()
  @IsOptional()
  payment_method?: string;

  @IsString()
  @IsOptional()
  receipt_number?: string;
  
  @IsString()
  @IsOptional()
  cooperative_id?: string;
  
  @IsString()
  @IsOptional()
  member_id?: string;
}
