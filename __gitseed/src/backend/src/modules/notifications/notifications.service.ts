import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@common/database/database.service';
import { NotificationsGateway } from './notifications.gateway';
import * as webpush from 'web-push';
import { 
  CreateNotificationDto, 
  BulkCreateNotificationDto, 
  RoleNotificationDto,
  NotificationFiltersDto,
  CreatePushSubscriptionDto,
  NotificationCategory,
  NotificationPriority,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private databaseService: DatabaseService,
    private configService: ConfigService,
    private notificationsGateway: NotificationsGateway,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT', 'mailto:admin@jsc.gov.ng');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.logger.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  private shouldSendPush(dto: CreateNotificationDto): boolean {
    const priority = dto.priority || NotificationPriority.MEDIUM;
    const category = dto.category || NotificationCategory.INFO;
    return (
      category === NotificationCategory.ACTION_REQUIRED ||
      priority === NotificationPriority.HIGH ||
      priority === NotificationPriority.URGENT
    );
  }

  /**
   * Register a push subscription
   */
  async createPushSubscription(userId: string, dto: CreatePushSubscriptionDto) {
    return this.databaseService.queryOne(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (user_id, endpoint) DO NOTHING 
       RETURNING *`,
      [userId, dto.endpoint, dto.p256dh, dto.auth]
    );
  }

  async removePushSubscription(userId: string, endpoint?: string) {
    if (endpoint) {
      await this.databaseService.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
        [userId, endpoint],
      );
      return;
    }
    await this.databaseService.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);
  }

  /**
   * Send push notification to a user
   */
  private async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; url?: string; data?: any; actions?: Array<{ action: string; title: string }> },
  ) {
    try {
      const subscriptions = await this.databaseService.query(
        'SELECT * FROM push_subscriptions WHERE user_id = $1',
        [userId]
      );

      if (subscriptions.length === 0) return;

      const jsonPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        data: payload.data,
        actions: payload.actions,
      });

      Promise.all(subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushSubscription, jsonPayload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired or invalid, remove it
            await this.databaseService.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
          } else {
            this.logger.error(`Error sending push to ${userId}: ${err.message}`);
          }
        }
      }));
    } catch (error) {
      this.logger.error(`Failed to process push for ${userId}: ${error.message}`);
    }
  }

  /**
   * Create a single notification
   */
  async create(dto: CreateNotificationDto) {
    const notification = await this.databaseService.queryOne(
      `INSERT INTO notifications (
        recipient_id, recipient_role, type, category, title, message,
        link, entity_type, entity_id, metadata, priority,
        action_label, action_link, created_by, expires_at, is_read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, false)
      RETURNING *`,
      [
        dto.recipient_id,
        dto.recipient_role || null,
        dto.type,
        dto.category,
        dto.title,
        dto.message,
        dto.link || null,
        dto.entity_type || null,
        dto.entity_id || null,
        dto.metadata ? JSON.stringify(dto.metadata) : null,
        dto.priority || 'medium',
        dto.action_label || null,
        dto.action_link || null,
        dto.created_by || 'system',
        dto.expires_at || null,
      ],
    );

    if (dto.recipient_id !== 'all' && this.shouldSendPush(dto)) {
      await this.sendPushNotification(dto.recipient_id, {
        title: dto.title,
        body: dto.message,
        url: dto.action_link || dto.link || '/notifications',
        data: notification,
        actions: dto.action_link ? [{ action: 'open', title: dto.action_label || 'Open' }] : undefined,
      });
    }

    this.logger.log(`Notification created for ${dto.recipient_id}: ${dto.title}`);
    return this.formatNotification(notification);
  }

  /**
   * Bulk create notifications for multiple users
   */
  async bulkCreate(dto: BulkCreateNotificationDto) {
    const { recipient_ids, ...notificationData } = dto;

    if (recipient_ids.length === 0) {
      return [];
    }

    // Build dynamic VALUES clause
    const valuesClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    recipient_ids.forEach((recipientId) => {
      valuesClauses.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, false)`
      );
      
      params.push(
        recipientId,
        notificationData.type,
        notificationData.category,
        notificationData.title,
        notificationData.message,
        notificationData.link || null,
        notificationData.entity_type || null,
        notificationData.entity_id || null,
        notificationData.metadata ? JSON.stringify(notificationData.metadata) : null,
        notificationData.priority || 'medium',
        notificationData.action_label || null,
        notificationData.action_link || null,
        notificationData.created_by || 'system',
        notificationData.expires_at || null,
      );
      
      paramIndex += 14;
    });

    const notifications = await this.databaseService.query(
      `INSERT INTO notifications (
        recipient_id, type, category, title, message, link,
        entity_type, entity_id, metadata, priority,
        action_label, action_link, created_by, expires_at, is_read
      ) VALUES ${valuesClauses.join(', ')}
      RETURNING *`,
      params,
    );

    if (this.shouldSendPush(notificationData as CreateNotificationDto)) {
      await Promise.all(
        recipient_ids.map((recipientId) =>
          this.sendPushNotification(recipientId, {
            title: notificationData.title,
            body: notificationData.message,
            url: notificationData.action_link || notificationData.link || '/notifications',
            data: { recipient_id: recipientId, ...notificationData },
            actions: notificationData.action_link
              ? [{ action: 'open', title: notificationData.action_label || 'Open' }]
              : undefined,
          }),
        ),
      );
    }

    this.logger.log(`Bulk created ${recipient_ids.length} notifications: ${notificationData.title}`);
    return notifications.map(n => this.formatNotification(n));
  }

  /**
   * Create role-based notification (broadcast to all users with a specific role)
   */
  async createRoleNotification(dto: RoleNotificationDto) {
    const { role, ...notificationData } = dto;

    const notification = await this.databaseService.queryOne(
      `INSERT INTO notifications (
        recipient_id, recipient_role, type, category, title, message,
        link, entity_type, entity_id, metadata, priority,
        action_label, action_link, created_by, expires_at, is_read
      ) VALUES ('all', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)
      RETURNING *`,
      [
        role,
        notificationData.type,
        notificationData.category,
        notificationData.title,
        notificationData.message,
        notificationData.link || null,
        notificationData.entity_type || null,
        notificationData.entity_id || null,
        notificationData.metadata ? JSON.stringify(notificationData.metadata) : null,
        notificationData.priority || 'medium',
        notificationData.action_label || null,
        notificationData.action_link || null,
        notificationData.created_by || 'system',
        notificationData.expires_at || null,
      ],
    );

    this.logger.log(`Role notification created for role '${role}': ${notificationData.title}`);
    const result = this.formatNotification(notification);
    this.notificationsGateway.sendNotification(result);
    if (this.shouldSendPush({ recipient_id: 'all', recipient_role: role, ...notificationData } as CreateNotificationDto)) {
      const users = await this.databaseService.query('SELECT id FROM users WHERE role = $1', [role]);
      await Promise.all(
        users.map((user) =>
          this.sendPushNotification(user.id, {
            title: notificationData.title,
            body: notificationData.message,
            url: notificationData.action_link || notificationData.link || '/notifications',
            data: { recipient_id: user.id, recipient_role: role, ...notificationData },
            actions: notificationData.action_link
              ? [{ action: 'open', title: notificationData.action_label || 'Open' }]
              : undefined,
          }),
        ),
      );
    }
    return result;
  }

  /**
   * Get user notifications with filters
   */
  async getUserNotifications(userId: string, userRole: string, filters?: NotificationFiltersDto) {
    let query = `
      SELECT * FROM notifications 
      WHERE (recipient_id = $1 OR recipient_id = 'all')
        AND (recipient_role IS NULL OR recipient_role = $2)
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    
    const params: any[] = [userId, userRole];
    let paramIndex = 3;

    // Apply filters
    if (filters?.type) {
      query += ` AND type = $${paramIndex}`;
      params.push(filters.type);
      paramIndex++;
    }

    if (filters?.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(filters.category);
      paramIndex++;
    }

    if (filters?.is_read !== undefined) {
      query += ` AND is_read = $${paramIndex}`;
      params.push(filters.is_read);
      paramIndex++;
    }

    if (filters?.priority) {
      query += ` AND priority = $${paramIndex}`;
      params.push(filters.priority);
      paramIndex++;
    }

    if (filters?.from_date) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.from_date);
      paramIndex++;
    }

    if (filters?.to_date) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.to_date);
      paramIndex++;
    }

    // Sort by priority and date (newest first)
    query += `
      ORDER BY 
        CASE priority
          WHEN 'urgent' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
        END DESC,
        created_at DESC
      LIMIT 100
    `;

    const notifications = await this.databaseService.query(query, params);
    return notifications.map(n => this.formatNotification(n));
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string, userRole: string) {
    const result = await this.databaseService.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE (recipient_id = $1 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $2)
         AND is_read = false
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, userRole],
    );

    return { unreadCount: parseInt(result?.count || '0') };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string, userRole: string) {
    const notification = await this.databaseService.queryOne(
      `SELECT id FROM notifications 
       WHERE id = $1 
         AND (recipient_id = $2 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $3)`,
      [id, userId, userRole],
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.databaseService.queryOne(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 RETURNING *',
      [id],
    );

    return this.formatNotification(updated);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, userRole: string) {
    await this.databaseService.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW() 
       WHERE (recipient_id = $1 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $2)
         AND is_read = false`,
      [userId, userRole],
    );

    return { message: 'All notifications marked as read' };
  }

  /**
   * Delete notification
   */
  async delete(id: string, userId: string, userRole: string) {
    const notification = await this.databaseService.queryOne(
      `SELECT id FROM notifications 
       WHERE id = $1 
         AND (recipient_id = $2 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $3)`,
      [id, userId, userRole],
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.databaseService.query('DELETE FROM notifications WHERE id = $1', [id]);

    return { message: 'Notification deleted' };
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: string, userRole: string) {
    const result = await this.databaseService.query(
      `DELETE FROM notifications 
       WHERE (recipient_id = $1 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $2)
         AND is_read = true 
       RETURNING id`,
      [userId, userRole],
    );

    return { 
      message: `Deleted ${result.length} read notifications`, 
      count: result.length 
    };
  }

  /**
   * Get notification by ID
   */
  async getById(id: string, userId: string, userRole: string) {
    const notification = await this.databaseService.queryOne(
      `SELECT * FROM notifications 
       WHERE id = $1 
         AND (recipient_id = $2 OR recipient_id = 'all')
         AND (recipient_role IS NULL OR recipient_role = $3)`,
      [id, userId, userRole],
    );

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.formatNotification(notification);
  }

  /**
   * Delete expired notifications (cleanup utility)
   */
  async deleteExpiredNotifications() {
    const result = await this.databaseService.query(
      `DELETE FROM notifications 
       WHERE expires_at IS NOT NULL AND expires_at <= NOW() 
       RETURNING id`,
    );

    this.logger.log(`Deleted ${result.length} expired notifications`);
    return { 
      message: `Deleted ${result.length} expired notifications`, 
      count: result.length 
    };
  }

  /**
   * Get notifications by entity
   */
  async getNotificationsByEntity(entityType: string, entityId: string) {
    const notifications = await this.databaseService.query(
      `SELECT * FROM notifications 
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId],
    );

    return notifications.map(n => this.formatNotification(n));
  }

  /**
   * Format notification response (parse JSON fields)
   */
  private formatNotification(notification: any) {
    return {
      ...notification,
      metadata: notification.metadata ? 
        (typeof notification.metadata === 'string' ? 
          JSON.parse(notification.metadata) : 
          notification.metadata) : 
        null,
    };
  }
}
