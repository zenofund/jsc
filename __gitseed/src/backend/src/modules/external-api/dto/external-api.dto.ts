import { IsString, IsNotEmpty, IsOptional, IsArray, IsNumber, IsDateString, Min, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Name of the external system' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Description of the API key usage' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Scopes/permissions for this API key', example: ['read:staff', 'write:deductions'] })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @ApiProperty({ description: 'Rate limit per hour', required: false, default: 1000 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  rateLimitPerHour?: number;

  @ApiProperty({ description: 'IP addresses allowed to use this key', required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ipWhitelist?: string[];

  @ApiProperty({ description: 'Expiration date (ISO 8601)', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class CreateExternalDeductionDto {
  @ApiProperty({ description: 'Staff ID' })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ description: 'Deduction amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'Description of the deduction' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'External system reference ID', required: false })
  @IsString()
  @IsOptional()
  externalReference?: string;

  @ApiProperty({ description: 'External system name', required: false, default: 'cooperative_system' })
  @IsString()
  @IsOptional()
  externalSystem?: string;

  @ApiProperty({ description: 'Additional metadata', required: false })
  @IsOptional()
  metadata?: any;
}

export class CreateWebhookDto {
  @ApiProperty({ description: 'Webhook name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Webhook URL to call' })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'Events to subscribe to', example: ['payroll.completed', 'deduction.processed'] })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiProperty({ description: 'Secret for webhook signature verification', required: false })
  @IsString()
  @IsOptional()
  secret?: string;
}

export class QueryStaffDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false, default: 50 })
  @IsOptional()
  limit?: number;

  @ApiProperty({ description: 'Search by name or staff number', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by department ID', required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty({ description: 'Filter by status', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
