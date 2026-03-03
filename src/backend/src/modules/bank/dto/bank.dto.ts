import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsEnum, IsDateString } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsOptional()
  bankCode?: string;

  @IsString()
  @IsOptional()
  branchName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
  
  @IsString()
  @IsOptional()
  accountType?: string;

  @IsBoolean()
  @IsOptional()
  apiEnabled?: boolean;
  
  @IsString()
  @IsOptional()
  bank_name?: string;
  
  @IsString()
  @IsOptional()
  bank_code?: string;
  
  @IsString()
  @IsOptional()
  account_number?: string;
  
  @IsString()
  @IsOptional()
  account_name?: string;
  
  @IsString()
  @IsOptional()
  account_type?: string;
  
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
  
  @IsBoolean()
  @IsOptional()
  api_enabled?: boolean;
}

export class UpdateBankAccountDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  branchName?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreatePaymentBatchDto {
  @IsString()
  @IsNotEmpty()
  payrollBatchId: string;

  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  @IsNotEmpty()
  fileFormat: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  userName: string;
}

export class UpdatePaymentBatchDto {
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class ProcessPaymentDto {
  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ApprovePaymentDto {
  @IsString()
  @IsNotEmpty()
  approverId: string;

  @IsString()
  @IsNotEmpty()
  approverName: string;
}

export class CreateBankStatementDto {
  @IsString()
  @IsNotEmpty()
  bankAccountId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsDateString()
  statementDate: string;

  @IsNumber()
  openingBalance: number;

  @IsNumber()
  closingBalance: number;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  userName: string;
}

export class ParseStatementDto {
  @IsString()
  @IsNotEmpty()
  csvContent: string;
}

export class CreateReconciliationDto {
  @IsString()
  @IsNotEmpty()
  paymentBatchId: string;

  @IsString()
  @IsNotEmpty()
  statementId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class ManualMatchDto {
  @IsString()
  @IsNotEmpty()
  transactionId: string;

  @IsString()
  @IsNotEmpty()
  statementLineId: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class CreateExceptionDto {
  @IsString()
  @IsNotEmpty()
  relatedEntityType: string;

  @IsString()
  @IsNotEmpty()
  relatedEntityId: string;

  @IsString()
  @IsNotEmpty()
  exceptionType: string;

  @IsString()
  @IsNotEmpty()
  severity: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  raisedBy: string;
}

export class ResolveExceptionDto {
  @IsString()
  @IsNotEmpty()
  resolutionNotes: string;

  @IsString()
  @IsNotEmpty()
  resolvedBy: string;
}

export class EscalateExceptionDto {
  @IsString()
  @IsNotEmpty()
  escalationNotes: string;

  @IsString()
  @IsNotEmpty()
  escalatedBy: string;
}
