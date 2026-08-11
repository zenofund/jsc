import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { DatabaseService } from '@common/database/database.service';
import { SalaryLookupService } from '../salary-structures/salary-lookup.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '@modules/audit/audit.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-05T00:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: DatabaseService,
          useValue: {
            queryOne: jest.fn(),
            query: jest.fn(),
            transaction: jest.fn(),
          },
        },
        {
          provide: SalaryLookupService,
          useValue: {
            getBasicSalary: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createRoleNotification: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('date canonicalization', () => {
    it('canonicalizes month-name dates with a weekday prefix', () => {
      const canonical = (service as any).canonicalizeBusinessDate('Tue. May 19', '2024-01-10');
      expect(canonical).toBe('2024-05-19');
    });
  });

  describe('createPromotion', () => {
    it('stores promotion_date/effective_date as YYYY-MM-DD', async () => {
      (databaseService.queryOne as jest.Mock)
        .mockResolvedValueOnce({
          id: 'staff-1',
          staff_number: 'S-001',
          first_name: 'Ada',
          last_name: 'Lovelace',
          grade_level: 10,
          step: 1,
          current_basic_salary: 1000,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'promotion-1' });

      await service.createPromotion(
        {
          staffId: 'staff-1',
          newGradeLevel: 11,
          newStep: 1,
          newBasicSalary: 1200,
          effectiveDate: 'Tue. May 19',
          promotionType: 'regular',
          remarks: 'test',
          status: 'pending',
        },
        'user-1',
      );

      expect(databaseService.queryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO promotions'),
        expect.arrayContaining(['2026-05-19', '2026-05-19']),
      );
    });

    it('rejects a second pending promotion for the same staff', async () => {
      (databaseService.queryOne as jest.Mock)
        .mockResolvedValueOnce({
          id: 'staff-1',
          staff_number: 'S-001',
          first_name: 'Ada',
          last_name: 'Lovelace',
          grade_level: 10,
          step: 1,
          current_basic_salary: 1000,
        })
        .mockResolvedValueOnce({
          id: 'promo-existing',
          staff_id: 'staff-1',
          status: 'pending',
          created_at: '2026-08-01T00:00:00Z',
        });

      await expect(
        service.createPromotion(
          {
            staffId: 'staff-1',
            newGradeLevel: 12,
            newStep: 1,
            newBasicSalary: 1500,
            effectiveDate: '2026-09-01',
            status: 'pending',
          },
          'user-1',
        ),
      ).rejects.toThrow('A pending promotion already exists for this staff member');
    });
  });

  describe('deletePromotion', () => {
    it('deletes a pending promotion', async () => {
      (databaseService.queryOne as jest.Mock)
        .mockResolvedValueOnce({
          id: 'promo-pending',
          staff_id: 'staff-1',
          status: 'pending',
        })
        .mockResolvedValueOnce({
          first_name: 'Ada',
          last_name: 'Lovelace',
          staff_number: 'S-001',
        });
      (databaseService.query as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deletePromotion('promo-pending', 'user-1');

      expect(result.message).toContain('deleted successfully');
      expect(databaseService.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM promotions'), [
        'promo-pending',
      ]);
    });

    it('deletes a rejected promotion', async () => {
      (databaseService.queryOne as jest.Mock)
        .mockResolvedValueOnce({
          id: 'promo-rejected',
          staff_id: 'staff-1',
          status: 'rejected',
        })
        .mockResolvedValueOnce(null);
      (databaseService.query as jest.Mock).mockResolvedValue(undefined);

      await expect(service.deletePromotion('promo-rejected', 'user-1')).resolves.toMatchObject({
        message: expect.stringContaining('deleted successfully'),
      });
    });

    it('refuses to delete an approved promotion', async () => {
      (databaseService.queryOne as jest.Mock).mockResolvedValueOnce({
        id: 'promo-approved',
        staff_id: 'staff-1',
        status: 'approved',
      });

      await expect(service.deletePromotion('promo-approved', 'user-1')).rejects.toThrow(
        'Only pending or rejected promotions can be deleted.',
      );
    });
  });
});
