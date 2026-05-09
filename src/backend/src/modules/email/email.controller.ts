import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, InternalServerErrorException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { EmailService } from './email.service';
import { CreateSmtpSettingDto, UpdateSmtpSettingDto, TestSmtpDto } from './dto/smtp-settings.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { DatabaseService } from '@common/database/database.service';

@ApiTags('Email')
@Controller('email')
@ApiBearerAuth()
export class EmailController {
  constructor(
    private emailService: EmailService,
    private databaseService: DatabaseService,
  ) {}

  @Get('smtp-settings')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get SMTP settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'SMTP settings retrieved' })
  async getSmtpSettings() {
    try {
      const settings = await this.databaseService.queryOne(
        `SELECT id, host, port, secure, username, from_email, is_active, 
                last_tested_at, test_status, test_message, created_at
         FROM smtp_settings 
         WHERE is_active = true
         LIMIT 1`,
      );
      return settings || null;
    } catch (err) {
      return null;
    }
  }

  @Post('smtp-settings')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create or update SMTP settings (Admin only)' })
  @ApiResponse({ status: 201, description: 'SMTP settings saved' })
  async createSmtpSettings(@Body() dto: CreateSmtpSettingDto, @Request() req) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        throw new Error('User ID not found in request');
      }

      // Encrypt password
      const encryptedPassword = this.emailService.encrypt(dto.password);

      // Deactivate existing settings
      await this.databaseService.query(
        'UPDATE smtp_settings SET is_active = false WHERE is_active = true',
      );

      // Insert new settings
      const result = await this.databaseService.queryOne(
        `INSERT INTO smtp_settings (host, port, secure, username, password_encrypted, from_email, from_name, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8)
         RETURNING id, host, port, secure, username, from_email, from_name, is_active, created_at`,
        [dto.host, dto.port, dto.secure, dto.username, encryptedPassword, dto.fromEmail, dto.fromName, userId],
      );

      return result;
    } catch (error: any) {
      console.error('Error creating SMTP settings:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Put('smtp-settings/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update SMTP settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'SMTP settings updated' })
  async updateSmtpSettings(
    @Param('id') id: string,
    @Body() dto: UpdateSmtpSettingDto,
    @Request() req,
  ) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new Error('User ID not found in request');
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (dto.host !== undefined) {
        updateFields.push(`host = $${paramIndex++}`);
        updateValues.push(dto.host);
      }
      if (dto.port !== undefined) {
        updateFields.push(`port = $${paramIndex++}`);
        updateValues.push(dto.port);
      }
      if (dto.secure !== undefined) {
        updateFields.push(`secure = $${paramIndex++}`);
        updateValues.push(dto.secure);
      }
      if (dto.username !== undefined) {
        updateFields.push(`username = $${paramIndex++}`);
        updateValues.push(dto.username);
      }
      if (dto.password !== undefined) {
        const encryptedPassword = this.emailService.encrypt(dto.password);
        updateFields.push(`password_encrypted = $${paramIndex++}`);
        updateValues.push(encryptedPassword);
      }
      if (dto.fromEmail !== undefined) {
        updateFields.push(`from_email = $${paramIndex++}`);
        updateValues.push(dto.fromEmail);
      }
      if (dto.fromName !== undefined) {
        updateFields.push(`from_name = $${paramIndex++}`);
        updateValues.push(dto.fromName);
      }

      updateFields.push(`updated_by = $${paramIndex++}`);
      updateValues.push(userId);
      updateFields.push(`updated_at = NOW()`);

      updateValues.push(id);

      const result = await this.databaseService.queryOne(
        `UPDATE smtp_settings 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, host, port, secure, username, from_email, from_name, is_active, updated_at`,
        updateValues,
      );

      return result;
    } catch (error: any) {
      console.error('Error updating SMTP settings:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Post('smtp-settings/test')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Test SMTP connection (Admin only)' })
  @ApiResponse({ status: 200, description: 'SMTP connection test result' })
  async testSmtpConnection(@Body() dto: TestSmtpDto, @Request() req) {
    try {
      const result = await this.emailService.testSmtpConnection(
        dto.host,
        dto.port,
        dto.secure,
        dto.username,
        dto.password,
      );

      // Save test result if testing active configuration
      const activeSettings = await this.databaseService.queryOne(
        'SELECT id FROM smtp_settings WHERE is_active = true AND host = $1 AND username = $2 LIMIT 1',
        [dto.host, dto.username],
      );

      if (activeSettings) {
        await this.databaseService.query(
          `UPDATE smtp_settings 
           SET last_tested_at = NOW(), test_status = $1, test_message = $2
           WHERE id = $3`,
          [result.success ? 'success' : 'failed', result.message, activeSettings.id],
        );
      }

      // Optionally send test email
      if (result.success && dto.testEmail) {
        const testEmailSent = await this.emailService.sendEmail({
          to: dto.testEmail,
          subject: 'SMTP Test Email - JSC Payroll System',
          html: `
            <h2>SMTP Configuration Test</h2>
            <p>This is a test email from the JSC Payroll Management System.</p>
            <p>If you're receiving this, your SMTP configuration is working correctly!</p>
            <p><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
          `,
          templateType: 'smtp_test',
          userId: req.user?.userId || null,
        });

        return {
          ...result,
          testEmailSent,
        };
      }

      return result;
    } catch (error: any) {
      console.error('Error testing SMTP settings:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  @Get('logs')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get email logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'Email logs retrieved' })
  async getEmailLogs() {
    const logs = await this.databaseService.query(
      `SELECT id, recipient_email, recipient_name, subject, template_type, status, 
              error_message, sent_at, created_at
       FROM email_logs
       ORDER BY created_at DESC
       LIMIT 100`,
    );

    return logs;
  }

  @Get('logs/stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get email statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Email statistics retrieved' })
  async getEmailStats() {
    const stats = await this.databaseService.queryOne(
      `SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h_count,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7d_count
       FROM email_logs`,
    );

    let byTemplate: any[] = [];
    try {
      byTemplate = await this.databaseService.query(
        `SELECT template_type, COUNT(*) as count, 
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
         FROM email_logs
         GROUP BY template_type
         ORDER BY count DESC`,
      );
    } catch {
      byTemplate = [];
    }

    return {
      ...stats,
      byTemplate,
    };
  }
}
