import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  APPROVE = 'approve',
  REJECT = 'reject',
  PROCESS = 'process',
  EXPORT = 'export',
}

export class CreateAuditDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  @IsNotEmpty()
  entity: string;

  @IsString()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  oldValues?: Record<string, any>;

  @IsOptional()
  newValues?: Record<string, any>;

  @IsString()
  @IsOptional()
  ipAddress?: string;
}
