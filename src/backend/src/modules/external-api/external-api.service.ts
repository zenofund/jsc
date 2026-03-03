import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { CreateApiKeyDto, CreateExternalDeductionDto, CreateWebhookDto, QueryStaffDto } from './dto/external-api.dto';
import * as crypto from 'crypto';

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);

  constructor(private databaseService: DatabaseService) {}

  // ==================== API KEY MANAGEMENT ====================

  /**
   * Generate a new API key
   */
  async createApiKey(dto: CreateApiKeyDto, userId: string) {
    // Generate secure random API key
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const apiKey = `jsc_live_${randomBytes}`;
    const apiKeyPrefix = apiKey.substring(0, 16); // First 16 chars for identification

    // Hash the API key for storage (similar to password hashing)
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const newKey = await this.databaseService.queryOne(
      `INSERT INTO api_keys (
        name, description, api_key, api_key_prefix, scopes, 
        ip_whitelist, rate_limit_per_hour, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, description, api_key_prefix, scopes, status, 
                rate_limit_per_hour, ip_whitelist, expires_at, created_at`,
      [
        dto.name,
        dto.description || null,
        apiKeyHash,
        apiKeyPrefix,
        dto.scopes,
        dto.ipWhitelist || null,
        dto.rateLimitPerHour || 1000,
        dto.expiresAt || null,
        userId,
      ],
    );

    this.logger.log(`API key created: ${dto.name} by user ${userId}`);

    // Return the plain API key only once (never shown again)
    return {
      ...newKey,
      apiKey, // Plain API key - save this!
      warning: 'Save this API key now. You will not be able to see it again.',
    };
  }

  /**
   * List all API keys
   */
  async listApiKeys() {
    return await this.databaseService.query(
      `SELECT id, name, description, api_key_prefix, scopes, status, 
              rate_limit_per_hour, ip_whitelist, expires_at, last_used_at, created_at
       FROM api_keys
       ORDER BY created_at DESC`,
    );
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string, userId: string) {
    const key = await this.databaseService.queryOne(
      `UPDATE api_keys 
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status`,
      [keyId],
    );

    if (!key) {
      throw new NotFoundException('API key not found');
    }

    this.logger.log(`API key revoked: ${key.name} by user ${userId}`);
    return key;
  }

  /**
   * Validate API key and check permissions
   */
  async validateApiKey(apiKey: string, requiredScope?: string): Promise<any> {
    // Hash the provided API key
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const key = await this.databaseService.queryOne(
      `SELECT id, name, scopes, status, ip_whitelist, rate_limit_per_hour, expires_at
       FROM api_keys
       WHERE api_key = $1`,
      [apiKeyHash],
    );

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Check if key is active
    if (key.status !== 'active') {
      throw new UnauthorizedException(`API key is ${key.status}`);
    }

    // Check if key has expired
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Check if required scope is present
    if (requiredScope && !key.scopes.includes(requiredScope)) {
      throw new UnauthorizedException(`Missing required scope: ${requiredScope}`);
    }

    // Update last used timestamp
    await this.databaseService.query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [key.id],
    );

    return key;
  }

  /**
   * Log API call
   */
  async logApiCall(
    apiKeyId: string,
    method: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string,
    requestBody: any,
    responseStatus: number,
    responseBody: any,
    executionTimeMs: number,
    errorMessage?: string,
  ) {
    await this.databaseService.query(
      `INSERT INTO api_call_logs (
        api_key_id, method, endpoint, ip_address, user_agent,
        request_body, response_status, response_body, execution_time_ms, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        apiKeyId,
        method,
        endpoint,
        ipAddress,
        userAgent,
        requestBody,
        responseStatus,
        responseBody,
        executionTimeMs,
        errorMessage || null,
      ],
    );
  }

  // ==================== STAFF DATA ACCESS ====================

  /**
   * Get staff list (for external systems)
   */
  async getStaff(query: QueryStaffDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const offset = (page - 1) * limit;

    const whereConditions = ['s.status = $1'];
    const params: any[] = ['active'];
    let paramIndex = 2;

    if (query.search) {
      whereConditions.push(`(
        s.first_name ILIKE $${paramIndex} OR 
        s.last_name ILIKE $${paramIndex} OR 
        s.staff_number ILIKE $${paramIndex}
      )`);
      params.push(`%${query.search}%`);
      paramIndex++;
    }

    if (query.departmentId) {
      whereConditions.push(`s.department_id = $${paramIndex}`);
      params.push(query.departmentId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const staff = await this.databaseService.query(
      `SELECT 
        s.id, s.staff_number, s.first_name, s.last_name, s.email,
        s.department_id, d.name as department_name,
        s.designation, s.grade_level, s.step,
        s.current_basic_salary, s.bank_name, s.account_number
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE ${whereClause}
       ORDER BY s.staff_number
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    const total = await this.databaseService.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM staff s WHERE ${whereClause}`,
      params,
    );

    return {
      data: staff,
      pagination: {
        page,
        limit,
        total: total.count,
        totalPages: Math.ceil(total.count / limit),
      },
    };
  }

  /**
   * Get single staff details
   */
  async getStaffById(staffId: string) {
    const staff = await this.databaseService.queryOne(
      `SELECT 
        s.id, s.staff_number, s.first_name, s.last_name, s.email,
        s.department_id, d.name as department_name,
        s.designation, s.grade_level, s.step,
        s.current_basic_salary, s.bank_name, s.account_number, s.account_name
       FROM staff s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.id = $1 AND s.status = 'active'`,
      [staffId],
    );

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    return staff;
  }

  // ==================== DEDUCTION MANAGEMENT ====================

  /**
   * Create external deduction
   */
  async createExternalDeduction(dto: CreateExternalDeductionDto, apiKeyId: string) {
    // Verify staff exists
    const staff = await this.getStaffById(dto.staffId);

    // Create staff deduction record first
    const deduction = await this.databaseService.queryOne(
      `INSERT INTO staff_deductions (
        staff_id, deduction_code, deduction_name, type, amount, 
        start_month, status, created_by
      ) VALUES ($1, $2, $3, 'fixed', $4, TO_CHAR(NOW(), 'YYYY-MM'), 'active', $5)
      RETURNING id`,
      [dto.staffId, 'COOP', dto.description, dto.amount, apiKeyId],
    );

    // Create external deduction tracking record
    const externalDeduction = await this.databaseService.queryOne(
      `INSERT INTO external_deductions (
        api_key_id, staff_deduction_id, external_reference, 
        external_system, staff_id, amount, description, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        apiKeyId,
        deduction.id,
        dto.externalReference || null,
        dto.externalSystem || 'cooperative_system',
        dto.staffId,
        dto.amount,
        dto.description,
        dto.metadata || null,
      ],
    );

    this.logger.log(`External deduction created: ${dto.amount} for staff ${dto.staffId}`);

    return {
      id: externalDeduction.id,
      staffId: externalDeduction.staff_id,
      amount: externalDeduction.amount,
      description: externalDeduction.description,
      status: externalDeduction.status,
      externalReference: externalDeduction.external_reference,
      createdAt: externalDeduction.created_at,
    };
  }

  /**
   * Get deduction status
   */
  async getDeductionStatus(deductionId: string) {
    const deduction = await this.databaseService.queryOne(
      `SELECT 
        ed.id, ed.staff_id, ed.amount, ed.description, ed.status,
        ed.external_reference, ed.external_system, ed.processed_at,
        ed.payroll_batch_id, pb.batch_number, pb.payroll_month,
        s.staff_number, s.first_name, s.last_name
       FROM external_deductions ed
       LEFT JOIN payroll_batches pb ON ed.payroll_batch_id = pb.id
       LEFT JOIN staff s ON ed.staff_id = s.id
       WHERE ed.id = $1`,
      [deductionId],
    );

    if (!deduction) {
      throw new NotFoundException('Deduction not found');
    }

    return deduction;
  }

  /**
   * Cancel pending deduction
   */
  async cancelDeduction(deductionId: string) {
    const deduction = await this.databaseService.queryOne(
      `UPDATE external_deductions
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [deductionId],
    );

    if (!deduction) {
      throw new BadRequestException('Deduction not found or already processed');
    }

    // Also deactivate the staff deduction
    await this.databaseService.query(
      `UPDATE staff_deductions
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1`,
      [deduction.staff_deduction_id],
    );

    this.logger.log(`External deduction cancelled: ${deductionId}`);
    return deduction;
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Create webhook endpoint
   */
  async createWebhook(dto: CreateWebhookDto, apiKeyId: string) {
    const webhook = await this.databaseService.queryOne(
      `INSERT INTO webhook_endpoints (
        api_key_id, name, url, events, secret
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [apiKeyId, dto.name, dto.url, dto.events, dto.secret || null],
    );

    this.logger.log(`Webhook created: ${dto.name} for API key ${apiKeyId}`);
    return webhook;
  }

  /**
   * Trigger webhook
   */
  async triggerWebhook(eventType: string, payload: any) {
    // Find all active webhooks subscribed to this event
    const webhooks = await this.databaseService.query(
      `SELECT * FROM webhook_endpoints
       WHERE status = 'active' AND $1 = ANY(events)`,
      [eventType],
    );

    for (const webhook of webhooks) {
      try {
        // Create delivery record
        const delivery = await this.databaseService.queryOne(
          `INSERT INTO webhook_deliveries (
            webhook_endpoint_id, event_type, payload, status
          ) VALUES ($1, $2, $3, 'pending')
          RETURNING id`,
          [webhook.id, eventType, payload],
        );

        // Send webhook (in background)
        this.deliverWebhook(delivery.id, webhook, payload);
      } catch (error) {
        this.logger.error(`Failed to queue webhook: ${error.message}`);
      }
    }
  }

  /**
   * Deliver webhook (async)
   */
  private async deliverWebhook(deliveryId: string, webhook: any, payload: any) {
    try {
      const axios = require('axios');
      
      // Sign payload if secret is configured
      const headers: any = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-JSC-Signature'] = signature;
      }

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: 30000, // 30 seconds
      });

      // Mark as successful
      await this.databaseService.query(
        `UPDATE webhook_deliveries
         SET status = 'success', http_status = $1, response_body = $2, delivered_at = NOW()
         WHERE id = $3`,
        [response.status, JSON.stringify(response.data).substring(0, 5000), deliveryId],
      );

      // Update webhook stats
      await this.databaseService.query(
        `UPDATE webhook_endpoints
         SET success_count = success_count + 1, last_triggered_at = NOW()
         WHERE id = $1`,
        [webhook.id],
      );

      this.logger.log(`Webhook delivered successfully: ${webhook.name}`);
    } catch (error) {
      // Mark as failed
      await this.databaseService.query(
        `UPDATE webhook_deliveries
         SET status = 'failed', http_status = $1, error_message = $2
         WHERE id = $3`,
        [error.response?.status || null, error.message, deliveryId],
      );

      // Update webhook stats
      await this.databaseService.query(
        `UPDATE webhook_endpoints
         SET failure_count = failure_count + 1
         WHERE id = $1`,
        [webhook.id],
      );

      this.logger.error(`Webhook delivery failed: ${webhook.name} - ${error.message}`);
    }
  }

  // ==================== PAYROLL PERIODS ====================

  /**
   * Get active payroll periods
   */
  async getPayrollPeriods() {
    return await this.databaseService.query(
      `SELECT id, batch_number, payroll_month, period_start, period_end, status, created_at
       FROM payroll_batches
       WHERE status IN ('draft', 'in_review', 'approved', 'locked')
       ORDER BY payroll_month DESC
       LIMIT 12`,
    );
  }
}