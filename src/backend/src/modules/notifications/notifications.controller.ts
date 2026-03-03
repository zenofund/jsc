import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  Request,
  UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { 
  CreateNotificationDto, 
  BulkCreateNotificationDto, 
  RoleNotificationDto,
  NotificationFiltersDto,
  CreatePushSubscriptionDto,
  NotificationType,
  NotificationCategory,
  NotificationPriority
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Create a single notification
   * POST /api/v1/notifications
   */
  @Post()
  @ApiOperation({ summary: 'Create a notification' })
  create(@Body() dto: CreateNotificationDto) {
    return this.notificationsService.create(dto);
  }

  /**
   * Create bulk notifications for multiple users
   * POST /api/v1/notifications/bulk
   */
  @Post('bulk')
  @ApiOperation({ summary: 'Create bulk notifications for multiple users' })
  createBulk(@Body() dto: BulkCreateNotificationDto) {
    return this.notificationsService.bulkCreate(dto);
  }

  /**
   * Create role-based notification (broadcast)
   * POST /api/v1/notifications/role
   */
  @Post('role')
  @ApiOperation({ summary: 'Create role-based notification for all users with a specific role' })
  createRoleNotification(@Body() dto: RoleNotificationDto) {
    return this.notificationsService.createRoleNotification(dto);
  }

  /**
   * Subscribe to push notifications
   * POST /api/v1/notifications/subscribe
   */
  @Post('subscribe')
  @ApiOperation({ summary: 'Register push subscription for current user' })
  subscribe(@Request() req, @Body() dto: CreatePushSubscriptionDto) {
    return this.notificationsService.createPushSubscription(req.user.userId, dto);
  }

  /**
   * Get user notifications with optional filters
   * GET /api/v1/notifications?type=payroll&is_read=false&category=action_required
   */
  @Get()
  @ApiOperation({ summary: 'Get user notifications with filters' })
  @ApiQuery({ name: 'type', enum: NotificationType, required: false })
  @ApiQuery({ name: 'category', enum: NotificationCategory, required: false })
  @ApiQuery({ name: 'is_read', type: Boolean, required: false })
  @ApiQuery({ name: 'priority', enum: NotificationPriority, required: false })
  @ApiQuery({ name: 'from_date', type: String, required: false })
  @ApiQuery({ name: 'to_date', type: String, required: false })
  getUserNotifications(
    @Request() req,
    @Query('type') type?: NotificationType,
    @Query('category') category?: NotificationCategory,
    @Query('is_read') is_read?: string,
    @Query('priority') priority?: NotificationPriority,
    @Query('from_date') from_date?: string,
    @Query('to_date') to_date?: string,
  ) {
    const filters: NotificationFiltersDto = {
      type,
      category,
      is_read: is_read === 'true' ? true : is_read === 'false' ? false : undefined,
      priority,
      from_date,
      to_date,
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );

    return this.notificationsService.getUserNotifications(
      req.user.userId,
      req.user.role,
      Object.keys(filters).length > 0 ? filters : undefined,
    );
  }

  /**
   * Get unread notification count
   * GET /api/v1/notifications/unread-count
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.userId, req.user.role);
  }

  /**
   * Get notification by ID
   * GET /api/v1/notifications/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  getById(@Param('id') id: string, @Request() req) {
    return this.notificationsService.getById(id, req.user.userId, req.user.role);
  }

  /**
   * Mark notification as read
   * PUT /api/v1/notifications/:id/read
   */
  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.userId, req.user.role);
  }

  /**
   * Mark all notifications as read
   * PUT /api/v1/notifications/mark-all-read
   */
  @Put('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId, req.user.role);
  }

  /**
   * Delete notification
   * DELETE /api/v1/notifications/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  delete(@Param('id') id: string, @Request() req) {
    return this.notificationsService.delete(id, req.user.userId, req.user.role);
  }

  /**
   * Delete all read notifications
   * DELETE /api/v1/notifications/read/all
   */
  @Delete('read/all')
  @ApiOperation({ summary: 'Delete all read notifications for current user' })
  deleteAllRead(@Request() req) {
    return this.notificationsService.deleteAllRead(req.user.userId, req.user.role);
  }

  /**
   * Delete expired notifications (Admin cleanup utility)
   * DELETE /api/v1/notifications/expired/cleanup
   */
  @Delete('expired/cleanup')
  @ApiOperation({ summary: 'Delete expired notifications (Admin only)' })
  deleteExpired() {
    return this.notificationsService.deleteExpiredNotifications();
  }

  /**
   * Get notifications by entity
   * GET /api/v1/notifications/entity/:entityType/:entityId
   */
  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Get notifications by entity type and ID' })
  getByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.notificationsService.getNotificationsByEntity(entityType, entityId);
  }
}
