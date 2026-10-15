import { BadRequestException } from '@nestjs/common';
import { ArrearsService } from './arrears.service';

describe('ArrearsService manual arrears', () => {
  let service: ArrearsService;
  let databaseService: { queryOne: jest.Mock };
  let notificationsService: { createRoleNotification: jest.Mock };

  beforeEach(() => {
    databaseService = {
      queryOne: jest.fn()
        .mockResolvedValueOnce({
          id: 'staff-id',
          staff_number: 'S001',
          first_name: 'Ada',
          last_name: 'Lovelace',
          current_basic_salary: 60000,
        })
        .mockResolvedValueOnce({ id: 'arrears-id' }),
    };
    notificationsService = { createRoleNotification: jest.fn().mockResolvedValue(undefined) };
    service = new ArrearsService(databaseService as any, notificationsService as any);
  });

  it('stores the basic portion and gross total in the manual arrears detail', async () => {
    await service.createArrears({
      staffId: 'staff-id',
      reason: 'salary_adjustment',
      basicAmount: '60000',
      grossAmount: '100000',
      effectiveDate: '2026-10-01',
    }, 'user-id');

    const [, insertValues] = databaseService.queryOne.mock.calls[1];
    expect(insertValues[8]).toBe(100000);
    expect(JSON.parse(insertValues[10])).toEqual([
      expect.objectContaining({
        month: '2026-10',
        amount: 100000,
        gross_amount: 100000,
        basic_amount: 60000,
      }),
    ]);
  });

  it('rejects basic arrears greater than gross arrears before querying staff', async () => {
    await expect(service.createArrears({
      staffId: 'staff-id',
      basicAmount: 100001,
      grossAmount: 100000,
      effectiveDate: '2026-10-01',
    }, 'user-id')).rejects.toThrow(BadRequestException);

    expect(databaseService.queryOne).not.toHaveBeenCalled();
  });

  it('keeps compatibility with legacy single-amount requests by treating the amount as basic and gross', async () => {
    await service.createArrears({
      staffId: 'staff-id',
      amount: 100000,
      effectiveDate: '2026-10-01',
    }, 'user-id');

    const [, insertValues] = databaseService.queryOne.mock.calls[1];
    expect(JSON.parse(insertValues[10])[0]).toEqual(
      expect.objectContaining({ amount: 100000, gross_amount: 100000, basic_amount: 100000 }),
    );
  });

  it('atomically assigns approved arrears to a draft batch only when they are unassigned', async () => {
    databaseService.queryOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'batch-id', status: 'draft' })
      .mockResolvedValueOnce({ id: 'arrears-id' });

    await service.mergeArrearsToPayroll('arrears-id', 'batch-id', 'user-id');

    const [assignmentQuery, assignmentValues] = databaseService.queryOne.mock.calls[1];
    expect(assignmentQuery).toContain("AND status = 'approved'");
    expect(assignmentQuery).toContain('AND payroll_batch_id IS NULL');
    expect(assignmentQuery).toContain('RETURNING id');
    expect(assignmentValues).toEqual(['batch-id', 'arrears-id']);
  });

  it('rejects arrears already claimed by another batch', async () => {
    databaseService.queryOne
      .mockReset()
      .mockResolvedValueOnce({ id: 'batch-id', status: 'draft' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'arrears-id',
        status: 'processed',
        payroll_batch_id: 'other-batch-id',
      });

    await expect(service.mergeArrearsToPayroll('arrears-id', 'batch-id', 'user-id'))
      .rejects.toThrow('already assigned to payroll batch other-batch-id');
  });

  it('rejects assignment to non-draft payroll batches', async () => {
    databaseService.queryOne.mockReset().mockResolvedValueOnce({ id: 'batch-id', status: 'locked' });

    await expect(service.mergeArrearsToPayroll('arrears-id', 'batch-id', 'user-id'))
      .rejects.toThrow('only be assigned to a draft payroll batch');
    expect(databaseService.queryOne).toHaveBeenCalledTimes(1);
  });
});
