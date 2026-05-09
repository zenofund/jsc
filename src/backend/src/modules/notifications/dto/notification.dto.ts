import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsEnum, 
  IsBoolean, 
  IsObject, 
  IsDateString 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum NotificationType {
  PAYROLL = 'payroll',
  LEAVE = 'leave',
  PROMOTION = 'promotion',
  LOAN = 'loan',
  BANK_PAYMENT = 'bank_payment',
  APPROVAL = 'approval',
  SYSTEM = 'system',
  ARREARS = 'arrears',
  DOCUMENT = 'document',
  STAFF = 'staff',
}

export enum NotificationCategory {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  ACTION_REQUIRED = 'action_required',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export class CreatePushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class RemovePushSubscriptionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endpoint?: string;
}

export class CreateNotificationDto {
  @ApiProperty({ description: 'User ID or "all" for broadcast' })
  @IsString()
  @IsNotEmpty()
  recipient_id: string;

  @ApiPropertyOptional({ description: 'Target specific role for broadcast notifications' })
  @IsString()
  @IsOptional()
  recipient_role?: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Deep link to related page' })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional({ description: 'Entity type (e.g., payroll_batch, leave_request)' })
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional({ description: 'Entity ID' })
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional({ description: 'Additional contextual data' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ enum: NotificationPriority, default: 'medium' })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional({ description: 'Action button label' })
  @IsString()
  @IsOptional()
  action_label?: string;

  @ApiPropertyOptional({ description: 'Action button URL' })
  @IsString()
  @IsOptional()
  action_link?: string;

  @ApiPropertyOptional({ description: 'User or system who created the notification' })
  @IsString()
  @IsOptional()
  created_by?: string;

  @ApiPropertyOptional({ description: 'Notification expiration date' })
  @IsDateString()
  @IsOptional()
  expires_at?: string;
}

export class BulkCreateNotificationDto {
  @ApiProperty({ description: 'Array of recipient user IDs', type: [String] })
  @IsString({ each: true })
  @IsNotEmpty()
  recipient_ids: string[];

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ enum: NotificationPriority, default: 'medium' })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action_label?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action_link?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  created_by?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expires_at?: string;
}

export class RoleNotificationDto {
  @ApiProperty({ description: 'Target role for notification' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ enum: NotificationPriority, default: 'medium' })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action_label?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action_link?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  created_by?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expires_at?: string;
}

export class NotificationFiltersDto {
  @ApiPropertyOptional({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @ApiPropertyOptional({ enum: NotificationCategory })
  @IsEnum(NotificationCategory)
  @IsOptional()
  category?: NotificationCategory;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_read?: boolean;

  @ApiPropertyOptional({ enum: NotificationPriority })
  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  to_date?: string;
}
