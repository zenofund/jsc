import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class AddCooperativeMemberDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  cooperativeId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyContribution?: number;
  
  @IsNumber()
  @Min(0)
  @IsOptional()
  shares_owned?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  suspension_reason?: string;
}
