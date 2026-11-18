import { SettingsService } from './settings.service';
import { AuditAction } from '../audit/dto/audit.dto';

describe('SettingsService tax configuration', () => {
  let service: SettingsService;
  let databaseService: { queryOne: jest.Mock; query: jest.Mock };
  let auditService: { log: jest.Mock };

  beforeEach(() => {
    databaseService = {
      queryOne: jest.fn(),
      query: jest.fn(),
    };
    auditService = { log: jest.fn() };
    service = new SettingsService(databaseService as any, auditService as any);
  });

  it('defaults staff adjustment allowances out of all regular contribution bases', async () => {
    databaseService.queryOne.mockResolvedValue({ tax_configuration: null });

    await expect(service.getTaxConfiguration()).resolves.toMatchObject({
      include_staff_adjustments_in_pension_base: false,
      include_staff_adjustments_in_nhia_base: false,
      include_staff_adjustments_in_nhf_base: false,
    });
  });

  it('preserves existing tax settings while saving configurable contribution-base rules', async () => {
    databaseService.queryOne
      .mockResolvedValueOnce({
        tax_configuration: {
          tax_brackets: [{ min: 0, max: null, rate: 10 }],
          include_staff_adjustments_in_pension_base: false,
        },
      })
      .mockResolvedValueOnce({
        tax_configuration: {
          tax_brackets: [{ min: 0, max: null, rate: 10 }],
          include_staff_adjustments_in_pension_base: true,
          include_staff_adjustments_in_nhia_base: false,
          include_staff_adjustments_in_nhf_base: false,
        },
      });

    await service.updateTaxConfiguration(
      { include_staff_adjustments_in_pension_base: true },
      'user-1',
    );

    expect(databaseService.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE system_settings'),
      [
        expect.objectContaining({
          tax_brackets: [{ min: 0, max: null, rate: 10 }],
          include_staff_adjustments_in_pension_base: true,
          include_staff_adjustments_in_nhia_base: false,
          include_staff_adjustments_in_nhf_base: false,
        }),
      ],
    );
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.UPDATE,
      newValues: expect.objectContaining({
        include_staff_adjustments_in_pension_base: true,
      }),
    }));
  });
});
