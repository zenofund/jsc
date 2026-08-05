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
        2,
        expect.stringContaining('INSERT INTO promotions'),
        expect.arrayContaining(['2026-05-19', '2026-05-19']),
      );
    });
  });
});
