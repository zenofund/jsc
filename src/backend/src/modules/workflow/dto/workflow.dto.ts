import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ApprovalAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  RETURN = 'return',
}

export class CreateWorkflowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AddStepDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  workflowId: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  stepOrder: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  stepName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roleRequired: string;
}

export class ProcessApprovalDto {
  @ApiProperty({ enum: ApprovalAction })
  @IsEnum(ApprovalAction)
  @IsNotEmpty()
  action: ApprovalAction;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  comments?: string;
}
