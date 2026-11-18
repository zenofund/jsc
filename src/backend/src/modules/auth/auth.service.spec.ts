import { ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '@common/database/database.service';
import { AuditService } from '@modules/audit/audit.service';
import { EmailService } from '@modules/email/email.service';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

describe('AuthService Super Admin permission boundaries', () => {
  let authService: AuthService;
  let databaseService: {
    queryOne: jest.Mock;
    query: jest.Mock;
    transaction: jest.Mock;
  };

  beforeEach(() => {
    databaseService = {
      queryOne: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    authService = new AuthService(
      databaseService as unknown as DatabaseService,
      {} as JwtService,
      {} as EmailService,
      {} as AuditService,
    );
  });

  it('rejects policy-level permissions assigned to the current Super Admin account', async () => {
    databaseService.queryOne.mockResolvedValue({
      id: 'super-admin-id',
      role: 'super_admin',
      email: 'admin@example.test',
      full_name: 'Platform Admin',
      permissions: [],
      department_id: null,
      staff_id: null,
      status: 'active',
    });
    databaseService.query
      .mockResolvedValueOnce([{ permission_key: 'payroll.batch.read' }]);

    await expect(
      authService.updateUser(
        'super-admin-id',
        { permissions: ['payroll.batch.read'] },
        'super-admin-id',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
  });

  it('rejects payslip permissions even though the catalog groups them under profile', async () => {
    databaseService.queryOne.mockResolvedValue({
      id: 'super-admin-id',
      role: 'super_admin',
      email: 'admin@example.test',
      full_name: 'Platform Admin',
      permissions: [],
      department_id: null,
      staff_id: null,
      status: 'active',
    });
    databaseService.query.mockResolvedValueOnce([{ permission_key: 'payslip.read' }]);

    await expect(
      authService.updateUser(
        'super-admin-id',
        { permissions: ['payslip.read'] },
        'super-admin-id',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
  });

  it('rejects changing the current Super Admin account role', async () => {
    databaseService.queryOne.mockResolvedValue({
      id: 'super-admin-id',
      role: 'super_admin',
    });

    await expect(
      authService.updateUser(
        'super-admin-id',
        { role: 'policy_admin' },
        'super-admin-id',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(databaseService.transaction).not.toHaveBeenCalled();
  });
});
