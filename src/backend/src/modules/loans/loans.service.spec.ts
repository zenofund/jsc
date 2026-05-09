
import { Test, TestingModule } from '@nestjs/testing';
import { LoansService } from './loans.service';
import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('LoansService', () => {
  let service: LoansService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        {
          provide: DatabaseService,
          useValue: {
            queryOne: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getLoanStats', () => {
    it('should return loan statistics including pending applications', async () => {
      const mockStats = {
        pending_applications: '5',
        approved_applications: '10',
        active_disbursements: '8',
        total_outstanding: '500000',
        total_disbursed: '1000000',
      };

      (databaseService.queryOne as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getLoanStats();

      // Verify the query includes both pending and guarantor_pending statuses
      const callArg = (databaseService.queryOne as jest.Mock).mock.calls[0][0];
      expect(callArg).toContain("status IN ('pending', 'guarantor_pending')");
      
      expect(result).toEqual(mockStats);
    });
  });

  describe('approveLoanApplication', () => {
    it('should approve a pending application', async () => {
      const appId = 'app-123';
      const userId = 'user-123';
      const dto = { approvedAmount: 50000, remarks: 'Approved' };

      const mockApplication = {
        id: appId,
        application_number: 'LN/2024/00001',
        status: 'pending',
        staff_id: 'staff-123',
        amount_requested: 50000,
      };

      const mockUpdated = {
        ...mockApplication,
        status: 'approved',
        amount_approved: 50000,
      };

      // Mock findOneLoanApplication
      jest.spyOn(service, 'findOneLoanApplication').mockResolvedValue(mockApplication as any);
      
      // Mock update
      (databaseService.queryOne as jest.Mock).mockResolvedValue(mockUpdated);
      
      // Mock notification
      (service['notificationsService'].create as unknown as jest.Mock) = jest.fn();

      const result = await service.approveLoanApplication(appId, dto, userId);

      expect(service.findOneLoanApplication).toHaveBeenCalledWith(appId);
      expect(databaseService.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE loan_applications"),
        [dto.approvedAmount, dto.remarks, userId, appId]
      );
      expect(result).toEqual(mockUpdated);
    });
  });
});
