import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const handler = () => undefined;
  const controller = class {};

  const createGuard = (metadata: Record<string, string[]>) => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => metadata[key]),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  const createContext = (user: Record<string, unknown>) =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('allows requests with all assigned permissions', () => {
    const guard = createGuard({ [PERMISSIONS_KEY]: ['payroll.batch.create', 'payroll.batch.submit'] });

    expect(guard.canActivate(createContext({
      role: 'payroll_loader',
      permissions: ['payroll.batch.create', 'payroll.batch.submit'],
    }))).toBe(true);
  });

  it('denies a permission that is not explicitly assigned', () => {
    const guard = createGuard({ [PERMISSIONS_KEY]: ['arrears.create'] });

    expect(() => guard.canActivate(createContext({
      role: 'payroll_loader',
      permissions: [],
    }))).toThrow('You do not have permission to access this resource');
  });

  it('continues to enforce role metadata for legacy routes', () => {
    const guard = createGuard({ [ROLES_KEY]: ['policy_admin'] });

    expect(() => guard.canActivate(createContext({
      role: 'payroll_officer',
      permissions: ['settings.manage'],
    }))).toThrow('You do not have permission to access this resource');
  });
});
