import { Test, TestingModule } from '@nestjs/testing';
import { DeductionsService } from './deductions.service';
import { DatabaseService } from '@common/database/database.service';

describe('DeductionsService', () => {
  let service: DeductionsService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeductionsService,
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

    service = module.get<DeductionsService>(DeductionsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('removeGlobalDeduction', () => {
    it('hard deletes the deduction and linked staff deductions from the database', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({}),
      };

      (databaseService.queryOne as jest.Mock).mockResolvedValue({ id: 'ded-1' });
      (databaseService.transaction as jest.Mock).mockImplementation(async (callback) => callback(client));

      const result = await service.removeGlobalDeduction('ded-1', 'user-1');

      expect(databaseService.queryOne).toHaveBeenCalledWith(
        'SELECT id FROM deductions WHERE id = $1',
        ['ded-1'],
      );
      expect(client.query).toHaveBeenNthCalledWith(
        1,
        'DELETE FROM staff_deductions WHERE deduction_id = $1',
        ['ded-1'],
      );
      expect(client.query).toHaveBeenNthCalledWith(
        2,
        'DELETE FROM deductions WHERE id = $1 RETURNING id',
        ['ded-1'],
      );
      expect(result).toEqual({ message: 'Deduction deleted successfully' });
    });
  });

  describe('createStaffDeduction', () => {
    it('creates a custom staff deduction without requiring a payroll setup deduction', async () => {
      (databaseService.queryOne as jest.Mock).mockResolvedValue({ id: 'sd-1' });

      const result = await service.createStaffDeduction(
        {
          staff_id: 'staff-1',
          entry_mode: 'custom',
          deduction_name: 'Staff Recovery',
          deduction_code: 'RECOVERY',
          type: 'fixed',
          amount: 10000,
          effective_from: '2026-07',
          frequency: 'one-time',
        },
        'user-1',
        'admin',
      );

      expect(databaseService.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO staff_deductions'),
        [
          'staff-1',
          null,
          'RECOVERY',
          'Staff Recovery',
          'fixed',
          10000,
          null,
          '2026-07-01',
          undefined,
          'one-time',
          'active',
          'user-1',
        ],
      );
      expect(result).toEqual({ id: 'sd-1' });
    });
  });
});
