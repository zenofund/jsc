import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsEnum, IsDateString, IsBoolean } from 'class-validator';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  annualDays: number;

  @IsBoolean()
  isPaid: boolean;

  @IsBoolean()
  carriesForward: boolean;
}

export class CreateLeaveRequestDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsString()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  reliefOfficerStaffId?: string;
}

export class ApproveLeaveDto {
  @IsString()
  @IsOptional()
  remarks?: string;
}
