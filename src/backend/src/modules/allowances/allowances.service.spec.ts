import { Test, TestingModule } from '@nestjs/testing';
import { AllowancesService } from './allowances.service';
import { DatabaseService } from '@common/database/database.service';

describe('AllowancesService', () => {
  let service: AllowancesService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllowancesService,
        {
          provide: DatabaseService,
          useValue: {
            queryOne: jest.fn(),
            query: jest.fn(),
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AllowancesService>(AllowancesService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('createStaffAllowance', () => {
    it('creates a custom staff allowance without requiring a payroll setup allowance', async () => {
      (databaseService.queryOne as jest.Mock).mockResolvedValue({ id: 'sa-1' });

      const result = await service.createStaffAllowance(
        {
          staff_id: 'staff-1',
          entry_mode: 'custom',
          allowance_name: 'Special Duty Allowance',
          allowance_code: 'SPEC_DUTY',
          type: 'fixed',
          amount: 25000,
          is_taxable: false,
          is_pensionable: true,
          effective_from: '2026-07',
          frequency: 'one-time',
        },
        'user-1',
        'admin',
      );

      expect(databaseService.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO staff_allowances'),
        [
          'staff-1',
          null,
          'SPEC_DUTY',
          'Special Duty Allowance',
          'fixed',
          false,
          true,
          25000,
          null,
          '2026-07-01',
          undefined,
          'one-time',
          'active',
          'user-1',
        ],
      );
      expect(result).toEqual({ id: 'sa-1' });
    });
  });
});
