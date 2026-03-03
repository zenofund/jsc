import { Injectable, UnauthorizedException, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@common/database/database.service';
import { EmailService } from '@modules/email/email.service';
import { AuditService } from '@modules/audit/audit.service';
import { AuditAction } from '@modules/audit/dto/audit.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private auditService: AuditService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.databaseService.queryOne(
      `SELECT id, email, password_hash, full_name, role, department_id, staff_id, status 
       FROM users 
       WHERE email = $1 AND status = 'active'`,
      [email],
    );

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return null;
    }

    // Remove password from user object
    const { password_hash, ...result } = user;
    return result;
  }

  /**
   * Login user and generate JWT token
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.databaseService.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id],
    );

    // Self-healing: Link staff profile if missing but email matches
    if (!user.staff_id) {
      const staff = await this.databaseService.queryOne(
        'SELECT id FROM staff WHERE email = $1',
        [user.email]
      );
      if (staff) {
        this.logger.log(`Auto-linking user ${user.email} to staff ${staff.id}`);
        await this.databaseService.query(
          'UPDATE users SET staff_id = $1 WHERE id = $2',
          [staff.id, user.id]
        );
        user.staff_id = staff.id;
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      staffId: user.staff_id,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User ${user.email} logged in successfully`);

    await this.auditService.log({
      userId: user.id,
      action: AuditAction.LOGIN,
      entity: 'user',
      entityId: user.id,
      description: 'User logged in',
    });

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        department_id: user.department_id,
        staff_id: user.staff_id,
      },
    };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.databaseService.queryOne(
      `SELECT u.id, u.email, u.full_name, u.role, u.department_id, u.staff_id, u.status, u.last_login,
              d.name as department_name, d.code as department_code,
              s.staff_number, s.first_name, s.last_name, s.designation
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN staff s ON u.staff_id = s.id
       WHERE u.id = $1`,
      [userId],
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Self-healing: Link staff profile if missing but email matches
    if (!user.staff_id && user.email) {
      const staff = await this.databaseService.queryOne(
        'SELECT id, staff_number, first_name, last_name, designation FROM staff WHERE email = $1',
        [user.email]
      );
      if (staff) {
        this.logger.log(`Auto-linking user ${user.email} to staff ${staff.id}`);
        await this.databaseService.query(
          'UPDATE users SET staff_id = $1 WHERE id = $2',
          [staff.id, userId]
        );
        user.staff_id = staff.id;
        user.staff_number = staff.staff_number;
        user.first_name = staff.first_name;
        user.last_name = staff.last_name;
        user.designation = staff.designation;
      }
    }

    return user;
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user with password hash
    const user = await this.databaseService.queryOne(
      'SELECT id, email, password_hash, full_name FROM users WHERE id = $1',
      [userId],
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.databaseService.query(
      `UPDATE users 
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, userId],
    );

    this.logger.log(`Password changed for user ${userId}`);

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: userId,
      description: 'Password changed',
    });

    return {
      message: 'Password changed successfully',
    };
  }

  async getAllUsers() {
    return this.databaseService.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.department_id, u.status, u.last_login,
              d.name as department
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.created_at DESC`
    );
  }

  /**
   * Create new user (Admin only)
   */
  async createUser(createUserDto: any, createdBy: string) {
    // Validate role
    if (createUserDto.role === 'staff' && !createUserDto.staff_id && !createUserDto.staffId) {
      throw new BadRequestException('Staff users must be created through the Staff Management module.');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const result = await this.databaseService.queryOne(
      `INSERT INTO users (email, password_hash, full_name, role, department_id, staff_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, full_name, role, department_id, staff_id, status`,
      [
        createUserDto.email,
        hashedPassword,
        createUserDto.full_name || createUserDto.fullName,
        createUserDto.role,
        createUserDto.department_id || createUserDto.departmentId || null,
        createUserDto.staff_id || createUserDto.staffId || null,
        'active',
      ],
    );

    this.logger.log(`New user created: ${createUserDto.email} by ${createdBy}`);

    await this.auditService.log({
      userId: createdBy,
      action: AuditAction.CREATE,
      entity: 'user',
      entityId: result.id,
      description: `Created user ${createUserDto.email}`,
      newValues: result,
    });

    return result;
  }

  /**
   * Update user details (Admin only)
   */
  async updateUser(userId: string, updateUserDto: any, updatedBy?: string) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updateUserDto.email) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updateUserDto.email);
    }

    const fullName = updateUserDto.full_name || updateUserDto.fullName;
    if (fullName) {
      fields.push(`full_name = $${paramIndex++}`);
      values.push(fullName);
    }
    
    if (updateUserDto.role) {
      fields.push(`role = $${paramIndex++}`);
      values.push(updateUserDto.role);
    }

    let deptId = updateUserDto.department_id !== undefined ? updateUserDto.department_id : updateUserDto.departmentId;
    if (deptId === undefined && updateUserDto.department) {
      const deptRow = await this.databaseService.queryOne(
        'SELECT id FROM departments WHERE name = $1',
        [updateUserDto.department],
      );
      deptId = deptRow?.id ?? null;
    }
    if (deptId !== undefined) {
      fields.push(`department_id = $${paramIndex++}`);
      values.push(deptId || null);
    }

    const staffId = updateUserDto.staff_id !== undefined ? updateUserDto.staff_id : updateUserDto.staffId;
    if (staffId !== undefined) {
      fields.push(`staff_id = $${paramIndex++}`);
      values.push(staffId || null);
    }

    if (updateUserDto.status) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updateUserDto.status);
    }

    if (fields.length === 0) {
      return { message: 'No changes to update' };
    }

    values.push(userId);
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, full_name, role, status`;

    const result = await this.databaseService.queryOne(query, values);

    if (!result) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`User ${userId} updated`);

    await this.auditService.log({
      userId: updatedBy,
      action: AuditAction.UPDATE,
      entity: 'user',
      entityId: userId,
      description: 'Updated user details',
      newValues: updateUserDto,
    });

    return result;
  }

  /**
   * Delete user (Admin only)
   */
  async deleteUser(userId: string, deletedBy?: string) {
    // Check if user exists
    const user = await this.databaseService.queryOne(
      'SELECT id FROM users WHERE id = $1',
      [userId],
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hard delete or soft delete? Let's do soft delete for now to be safe, unless email uniqueness is an issue.
    // Actually, usually admin expects delete to free up email. But for audit, soft delete is better.
    // Let's do hard delete for now as per "Delete" button expectation, or update status to 'inactive'.
    // If we just update status to 'inactive', the email is still taken.
    // Let's implement hard delete but with checks (e.g. constraints).
    
    try {
      await this.databaseService.query(
        'DELETE FROM users WHERE id = $1',
        [userId],
      );
      this.logger.log(`User ${userId} deleted`);
      
      await this.auditService.log({
        userId: deletedBy,
        action: AuditAction.DELETE,
        entity: 'user',
        entityId: userId,
        description: 'Deleted user',
      });

      return { message: 'User deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete user ${userId}: ${error.message}`);
      // Fallback to soft delete if FK constraints fail
      await this.databaseService.query(
        "UPDATE users SET status = 'inactive' WHERE id = $1",
        [userId],
      );
      return { message: 'User deactivated (could not delete due to dependencies)' };
    }
  }

  /**
   * Request password reset - Generate reset token and send email
   */
  async requestPasswordReset(email: string) {
    const user = await this.databaseService.queryOne(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND status = $2',
      [email, 'active'],
    );

    // Always return success to prevent email enumeration attacks
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent email: ${email}`);
      return {
        message: 'If your email is registered, you will receive password reset instructions',
      };
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store hashed token in database
    await this.databaseService.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET token_hash = $2, expires_at = $3, created_at = NOW(), used_at = NULL`,
      [user.id, tokenHash, expiresAt],
    );

    // In production, send email with reset link
    // For now, log the token (in production, this should be in an email)
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    this.logger.log(`Password reset requested for ${email}`);
    this.logger.log(`Reset link (DEVELOPMENT ONLY - should be emailed): ${resetLink}`);

    // Send email with reset link
    await this.emailService.sendPasswordResetEmail(user.email, user.full_name, resetLink);

    return {
      message: 'If your email is registered, you will receive password reset instructions',
      // In development, return the token for testing
      ...(process.env.NODE_ENV === 'development' && { 
        resetToken,
        resetLink,
        note: 'Token included for development testing only'
      }),
    };
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string) {
    // Hash the provided token to match against database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const resetRecord = await this.databaseService.queryOne(
      `SELECT prt.user_id, prt.expires_at, prt.used_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token_hash = $1 AND u.status = 'active'`,
      [tokenHash],
    );

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token has expired
    if (new Date() > new Date(resetRecord.expires_at)) {
      throw new BadRequestException('Reset token has expired');
    }

    // Check if token has already been used
    if (resetRecord.used_at) {
      throw new BadRequestException('Reset token has already been used');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await this.databaseService.query('BEGIN');
    
    try {
      await this.databaseService.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [hashedPassword, resetRecord.user_id],
      );

      await this.databaseService.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = $1',
        [tokenHash],
      );

      await this.databaseService.query('COMMIT');

      this.logger.log(`Password reset successfully for user ${resetRecord.user_id}`);

      return {
        message: 'Password has been reset successfully. You can now login with your new password.',
      };
    } catch (error) {
      await this.databaseService.query('ROLLBACK');
      this.logger.error(`Password reset failed: ${error.message}`);
      throw new BadRequestException('Failed to reset password');
    }
  }
}
