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
          'basic',
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
      expect(result).toMatchObject({ id: 'sa-1' });
    });

    it('stores gross calculation basis for custom percentage staff allowances', async () => {
      (databaseService.queryOne as jest.Mock).mockResolvedValue({ id: 'sa-2' });

      await service.createStaffAllowance(
        {
          staff_id: 'staff-2',
          entry_mode: 'custom',
          allowance_name: 'Executive Allowance',
          type: 'percentage',
          calculation_basis: 'gross',
          percentage: 12.5,
          effective_from: '2026-07',
        },
        'user-2',
        'admin',
      );

      expect(databaseService.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO staff_allowances'),
        expect.arrayContaining([
          'staff-2',
          null,
          expect.any(String),
          'Executive Allowance',
          'percentage',
          'gross',
        ]),
      );
    });

    it('rejects blank amount values for fixed staff allowances', async () => {
      await expect(
        service.createStaffAllowance(
          {
            staff_id: 'staff-3',
            entry_mode: 'custom',
            allowance_name: 'Special Duty Allowance',
            type: 'fixed',
            amount: '',
            effective_from: '2026-07',
          },
          'user-3',
          'admin',
        ),
      ).rejects.toThrow('Amount is required');
    });
  });

  describe('updateStaffAllowance', () => {
    it('rejects blank amount values when updating a fixed staff allowance', async () => {
      (databaseService.queryOne as jest.Mock).mockResolvedValue({
        id: 'sa-3',
        allowance_id: null,
        custom_allowance_code: 'SPEC_DUTY',
        custom_allowance_name: 'Special Duty Allowance',
        custom_type: 'fixed',
        custom_calculation_basis: 'basic',
        custom_is_taxable: true,
        custom_is_pensionable: false,
        status: 'active',
      });

      await expect(
        service.updateStaffAllowance(
          'sa-3',
          {
            entry_mode: 'custom',
            allowance_name: 'Special Duty Allowance',
            type: 'fixed',
            amount: '',
          },
          'user-3',
        ),
      ).rejects.toThrow('Amount is required');
    });
  });
});
