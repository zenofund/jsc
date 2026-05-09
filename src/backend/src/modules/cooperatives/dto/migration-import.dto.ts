import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MigrationCooperativeRowDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cooperative_type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthly_contribution_required?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  share_capital_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimum_shares?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class MigrationMemberRowDto {
  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @IsOptional()
  @IsString()
  cooperativeCode?: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  staffNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyContribution?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  shares_owned?: number;
}

export class MigrationContributionRowDto {
  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @IsOptional()
  @IsString()
  cooperativeCode?: string;

  @IsOptional()
  @IsString()
  memberId?: string;

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

  @IsOptional()
  @IsString()
  contributionType?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  receiptNumber?: string;
}

export class MigrationOpeningBalanceRowDto {
  @IsOptional()
  @IsString()
  cooperativeId?: string;

  @IsOptional()
  @IsString()
  cooperativeCode?: string;

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

  @IsOptional()
  @IsString()
  contributionType?: string;
}

export class CooperativeMigrationImportDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationCooperativeRowDto)
  cooperatives?: MigrationCooperativeRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationMemberRowDto)
  members?: MigrationMemberRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationOpeningBalanceRowDto)
  openingBalances?: MigrationOpeningBalanceRowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MigrationContributionRowDto)
  contributions?: MigrationContributionRowDto[];
}
