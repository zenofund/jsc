import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';

export interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  templateType: string;
  userId?: string;
  metadata?: any;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly encryptionKey = process.env.SMTP_ENCRYPTION_KEY || 'jsc-payroll-smtp-key-32-chars!';
  private readonly smtpConnectionTimeoutMs = 10_000;
  private readonly smtpGreetingTimeoutMs = 10_000;
  private readonly smtpSocketTimeoutMs = 20_000;

  constructor(private databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureEmailLogsTable();
  }

  private async ensureEmailLogsTable() {
    try {
      await this.databaseService.query(`
        ALTER TABLE email_logs 
        ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255)
      `);
    } catch (error: any) {
      this.logger.warn(`Failed to ensure email logs schema: ${error?.message}`);
    }
  }

  /**
   * Get active SMTP configuration
   */
  async getActiveSmtpConfig() {
    const config = await this.databaseService.queryOne(
      `SELECT id, host, port, secure, username, password_encrypted, from_email, from_name
       FROM smtp_settings 
       WHERE is_active = true
       LIMIT 1`,
    );

    if (!config) {
      return null;
    }

    // Decrypt password
    const password = this.decrypt(config.password_encrypted);

    return {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: password,
      },
      from: {
        email: config.from_email,
        name: config.from_name,
      },
    };
  }

  /**
   * Send email using active SMTP configuration
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const smtpConfig = await this.getActiveSmtpConfig();

      if (!smtpConfig) {
        this.logger.warn('No active SMTP configuration found');
        await this.logEmail(options, 'failed', 'No SMTP configuration');
        return false;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: smtpConfig.auth,
        connectionTimeout: this.smtpConnectionTimeoutMs,
        greetingTimeout: this.smtpGreetingTimeoutMs,
        socketTimeout: this.smtpSocketTimeoutMs,
      });

      // Send email
      const info = await transporter.sendMail({
        from: `"${smtpConfig.from.name}" <${smtpConfig.from.email}>`,
        to: options.toName ? `"${options.toName}" <${options.to}>` : options.to,
        subject: options.subject,
        text: options.text || this.htmlToText(options.html),
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      await this.logEmail(options, 'sent');

      return true;
    } catch (error) {
      const message = String((error as any)?.message || error);
      const code = String((error as any)?.code || '');
      this.logger.error(`Failed to send email to ${options.to}: ${code ? `${code} ` : ''}${message}`);
      await this.logEmail(options, 'failed', code ? `${code}: ${message}` : message);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, resetLink: string): Promise<boolean> {
    const html = this.getPasswordResetTemplate(name, resetLink);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: 'Reset Your JSC Payroll System Password',
      html,
      templateType: 'password_reset',
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, name: string, tempPassword: string): Promise<boolean> {
    const html = this.getWelcomeTemplate(name, tempPassword);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: 'Welcome to JSC Payroll Management System',
      html,
      templateType: 'welcome',
    });
  }

  /**
   * Send payroll completion notification
   */
  async sendPayrollCompletionEmail(
    email: string,
    name: string,
    batchName: string,
    month: string,
    year: number,
  ): Promise<boolean> {
    const html = this.getPayrollCompletionTemplate(name, batchName, month, year);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `Payroll Processed: ${month} ${year}`,
      html,
      templateType: 'payroll_completion',
    });
  }

  /**
   * Send approval request notification
   */
  async sendApprovalRequestEmail(
    email: string,
    name: string,
    requestType: string,
    requestDetails: string,
  ): Promise<boolean> {
    const html = this.getApprovalRequestTemplate(name, requestType, requestDetails);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `Approval Required: ${requestType}`,
      html,
      templateType: 'approval_request',
    });
  }

  /**
   * Send leave request notification
   */
  async sendLeaveNotificationEmail(
    email: string,
    name: string,
    leaveType: string,
    status: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean> {
    const html = this.getLeaveNotificationTemplate(name, leaveType, status, startDate, endDate);

    return this.sendEmail({
      to: email,
      toName: name,
      subject: `Leave Request ${status}: ${leaveType}`,
      html,
      templateType: 'leave_notification',
    });
  }

  /**
   * Test SMTP configuration
   */
  async testSmtpConnection(host: string, port: number, secure: boolean, username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: username,
          pass: password,
        },
        connectionTimeout: this.smtpConnectionTimeoutMs,
        greetingTimeout: this.smtpGreetingTimeoutMs,
        socketTimeout: this.smtpSocketTimeoutMs,
      });

      await transporter.verify();

      return {
        success: true,
        message: 'SMTP connection successful',
      };
    } catch (error) {
      const message = String((error as any)?.message || error);
      const code = String((error as any)?.code || '');
      const lower = message.toLowerCase();
      if (code === 'ETIMEDOUT' || lower.includes('timeout')) {
        return {
          success: false,
          message: `SMTP connection timeout to ${host}:${port}. This usually means the server running the backend cannot reach the SMTP host (firewall/VPC rules, blocked outbound SMTP ports, wrong host/port).`,
        };
      }
      return {
        success: false,
        message: code ? `${code}: ${message}` : message,
      };
    }
  }

  /**
   * Log email to database
   */
  private async logEmail(options: EmailOptions, status: string, errorMessage?: string) {
    try {
      await this.databaseService.query(
        `INSERT INTO email_logs (recipient_email, recipient_name, subject, template_type, status, error_message, sent_at, user_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          options.to,
          options.toName || null,
          options.subject,
          options.templateType,
          status,
          errorMessage || null,
          status === 'sent' ? new Date() : null,
          options.userId || null,
          JSON.stringify(options.metadata || {}),
        ],
      );
    } catch (error) {
      this.logger.error(`Failed to log email: ${error.message}`);
    }
  }

  /**
   * Encrypt password for storage
   */
  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt password from storage
   */
  decrypt(text: string): string {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Convert HTML to plain text
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // Email Templates

  private getPasswordResetTemplate(name: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #008000; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Judicial Service Committee</h1>
    <p style="margin: 5px 0 0 0; font-size: 14px;">Payroll Management System</p>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #008000; margin-top: 0;">Reset Your Password</h2>
    
    <p>Hi ${name},</p>
    
    <p>You requested to reset your password for the JSC Payroll Management System.</p>
    
    <p>Click the button below to reset your password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #008000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
    <p style="font-size: 12px; color: #0066cc; word-break: break-all;">${resetLink}</p>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 13px; color: #666;">
      <strong>This link will expire in 1 hour for security reasons.</strong>
    </p>
    
    <p style="font-size: 13px; color: #666;">If you didn't request this password reset, please ignore this email or contact your system administrator if you have concerns.</p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>&copy; ${new Date().getFullYear()} Judicial Service Committee. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getWelcomeTemplate(name: string, tempPassword: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to JSC Payroll System</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #008000; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Welcome to JSC Payroll System</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <h2 style="color: #008000; margin-top: 0;">Your Account Has Been Created</h2>
    
    <p>Hi ${name},</p>
    
    <p>Your account for the Judicial Service Committee Payroll Management System has been created.</p>
    
    <div style="background-color: #fff; padding: 20px; border-left: 4px solid #008000; margin: 20px 0;">
      <p style="margin: 0;"><strong>Temporary Password:</strong></p>
      <p style="margin: 10px 0 0 0; font-size: 18px; font-family: monospace; color: #008000;">${tempPassword}</p>
    </div>
    
    <p><strong>Please change your password immediately after your first login.</strong></p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #008000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Login Now</a>
    </div>
    
    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 13px; color: #666;">
      If you have any questions or need assistance, please contact your system administrator.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>&copy; ${new Date().getFullYear()} Judicial Service Committee. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getPayrollCompletionTemplate(name: string, batchName: string, month: string, year: number): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payroll Processed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #008000; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Payroll Processed</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hi ${name},</p>
    
    <p>The payroll for <strong>${month} ${year}</strong> has been successfully processed.</p>
    
    <div style="background-color: #fff; padding: 20px; border-left: 4px solid #008000; margin: 20px 0;">
      <p style="margin: 0;"><strong>Batch:</strong> ${batchName}</p>
      <p style="margin: 10px 0 0 0;"><strong>Period:</strong> ${month} ${year}</p>
    </div>
    
    <p>Your payslip is now available in the system. Please log in to view and download your payslip.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #008000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Payslip</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>&copy; ${new Date().getFullYear()} Judicial Service Committee. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getApprovalRequestTemplate(name: string, requestType: string, details: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Approval Required</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #b5a642; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Approval Required</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hi ${name},</p>
    
    <p>A new <strong>${requestType}</strong> requires your approval.</p>
    
    <div style="background-color: #fff; padding: 20px; border-left: 4px solid #b5a642; margin: 20px 0;">
      <p style="margin: 0;"><strong>Request Type:</strong> ${requestType}</p>
      <p style="margin: 10px 0 0 0;">${details}</p>
    </div>
    
    <p>Please log in to the system to review and process this request.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #008000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Review Request</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>&copy; ${new Date().getFullYear()} Judicial Service Committee. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  private getLeaveNotificationTemplate(name: string, leaveType: string, status: string, startDate: string, endDate: string): string {
    const statusColor = status === 'approved' ? '#008000' : status === 'rejected' ? '#dc2626' : '#b5a642';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Leave Request ${status}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Leave Request ${status.toUpperCase()}</h1>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 8px 8px;">
    <p>Hi ${name},</p>
    
    <p>Your <strong>${leaveType}</strong> request has been <strong>${status}</strong>.</p>
    
    <div style="background-color: #fff; padding: 20px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
      <p style="margin: 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 10px 0 0 0;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
      <p style="margin: 10px 0 0 0;"><strong>Status:</strong> <span style="color: ${statusColor}; text-transform: uppercase;">${status}</span></p>
    </div>
    
    <p>Please log in to the system to view full details.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #008000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Details</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
    <p>&copy; ${new Date().getFullYear()} Judicial Service Committee. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }
}
