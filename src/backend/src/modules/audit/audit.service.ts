import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { CreateAuditDto, AuditAction } from './dto/audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private databaseService: DatabaseService) {}

  /**
   * Log an audit trail entry
   */
  async log(dto: CreateAuditDto) {
    try {
      const audit = await this.databaseService.queryOne(
        `INSERT INTO audit_trail (
          user_id, action, entity, entity_id, description, 
          old_values, new_values, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          dto.userId || null,
          dto.action,
          dto.entity,
          dto.entityId || null,
          dto.description || null,
          dto.oldValues ? JSON.stringify(dto.oldValues) : null,
          dto.newValues ? JSON.stringify(dto.newValues) : null,
          dto.ipAddress || null,
        ],
      );

      return audit;
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      this.logger.error(`Failed to log audit trail: ${error.message}`);
      return null;
    }
  }

  /**
   * Get audit trail with filters and pagination
   */
  async findAll(query: {
    userId?: string;
    action?: AuditAction;
    entity?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 50, userId, action, entity, entityId, startDate, endDate } = query;
    const offset = (page - 1) * limit;

    const whereConditions = [];
    const params = [];
    let paramIndex = 1;

    if (userId) {
      whereConditions.push(`at.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (action) {
      whereConditions.push(`at.action = $${paramIndex++}`);
      params.push(action);
    }

    if (entity) {
      whereConditions.push(`at.entity = $${paramIndex++}`);
      params.push(entity);
    }

    if (entityId) {
      whereConditions.push(`at.entity_id = $${paramIndex++}`);
      params.push(entityId);
    }

    if (startDate) {
      whereConditions.push(`at.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push(`at.created_at <= $${paramIndex++}`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM audit_trail at ${whereClause}`;
    const countResult = await this.databaseService.queryOne<{ total: number }>(countQuery, params);
    const total = parseInt(countResult?.total?.toString() || '0');

    // Get paginated data
    const dataQuery = `
      SELECT 
        at.*,
        u.email as user_email,
        u.full_name as user_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      ${whereClause}
      ORDER BY at.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const data = await this.databaseService.query(dataQuery, [...params, limit, offset]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit trail for a specific entity
   */
  async findByEntity(entity: string, entityId: string) {
    return this.databaseService.query(
      `SELECT 
        at.*,
        u.email as user_email,
        u.full_name as user_name
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      WHERE at.entity = $1 AND at.entity_id = $2
      ORDER BY at.created_at DESC`,
      [entity, entityId],
    );
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit: number = 50) {
    return this.databaseService.query(
      `SELECT * FROM audit_trail 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2`,
      [userId, limit],
    );
  }

  /**
   * Get audit statistics
   */
  async getStatistics(startDate?: string, endDate?: string) {
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      whereClause = `WHERE created_at >= $${paramIndex++} AND created_at <= $${paramIndex++}`;
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause = `WHERE created_at >= $${paramIndex++}`;
      params.push(startDate);
    } else if (endDate) {
      whereClause = `WHERE created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    const actionStats = await this.databaseService.query(
      `SELECT action, COUNT(*) as count 
      FROM audit_trail 
      ${whereClause}
      GROUP BY action 
      ORDER BY count DESC`,
      params,
    );

    const entityStats = await this.databaseService.query(
      `SELECT entity, COUNT(*) as count 
      FROM audit_trail 
      ${whereClause}
      GROUP BY entity 
      ORDER BY count DESC 
      LIMIT 10`,
      params,
    );

    const userStats = await this.databaseService.query(
      `SELECT 
        at.user_id,
        u.email,
        u.full_name,
        COUNT(*) as count 
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      ${whereClause}
      GROUP BY at.user_id, u.email, u.full_name 
      ORDER BY count DESC 
      LIMIT 10`,
      params,
    );

    return {
      actionStats,
      entityStats,
      userStats,
    };
  }
}
