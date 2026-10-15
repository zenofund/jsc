import { PayrollService } from './payroll.service';

describe('PayrollService arrears deductions', () => {
  let service: PayrollService;
  let databaseService: { query: jest.Mock };

  beforeEach(() => {
    service = Object.create(PayrollService.prototype);
    (service as any).isExcludedFromPayrollItem = jest.fn().mockReturnValue(false);
    databaseService = { query: jest.fn().mockResolvedValue([]) };
    (service as any).databaseService = databaseService;
  });

  it('loads only arrears assigned to the requested batch, including on regeneration', async () => {
    const assignedArrear = { id: 'assigned-arrear', status: 'processed', payroll_batch_id: 'batch-id' };
    databaseService.query.mockResolvedValueOnce([assignedArrear]);

    await expect((service as any).getBatchArrears('batch-id')).resolves.toEqual([assignedArrear]);

    const [query, values] = databaseService.query.mock.calls[0];
    expect(query).toContain("WHERE status = 'processed' AND payroll_batch_id = $1");
    expect(values).toEqual(['batch-id']);
  });

  it('uses configured basic and gross bases and applies fixed deductions once', () => {
    const result = (service as any).calculateManualArrearsDeductions(
      [
        {
          code: 'UNION',
          name: 'Union Dues',
          type: 'percentage',
          percentage: 5,
          calculation_basis: 'basic',
        },
        {
          code: 'NHF',
          name: 'National Housing Fund',
          type: 'percentage',
          percentage: 2.5,
          calculation_basis: 'gross',
          is_paye_relief: true,
        },
        {
          code: 'FIXED',
          name: 'Fixed Recovery',
          type: 'fixed',
          amount: 1250,
          calculation_basis: 'gross',
        },
      ],
      60000,
      100000,
      { grade_level: '10', employment_type: 'Permanent' },
    );

    expect(result.items.map((item: any) => [item.code, item.amount, item.calculation_basis])).toEqual([
      ['UNION_MANUAL_ARREARS', 3000, 'basic'],
      ['NHF_MANUAL_ARREARS', 2500, 'gross'],
      ['FIXED_MANUAL_ARREARS', 1250, 'gross'],
    ]);
    expect(result.total).toBe(6750);
    expect(result.payeReliefs).toEqual({ pension: 0, nhf: 2500, nhia: 0 });
  });

  it('does not use the promotion-only flag when calculating manual arrears deductions', () => {
    const result = (service as any).calculateManualArrearsDeductions(
      [{
        code: 'NHIA',
        name: 'NHIA',
        type: 'percentage',
        percentage: 1,
        calculation_basis: 'gross',
        applies_to_promotion_arrears: false,
      }],
      0,
      50000,
      {},
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].amount).toBe(500);
  });

  it('keeps promotion arrears eligibility controlled by its dedicated flag', () => {
    expect((service as any).getPromotionArrearsDeductionKind({
      applies_to_promotion_arrears: true,
      promotion_arrears_basis: 'gross',
    })).toBe('gross');
    expect((service as any).getPromotionArrearsDeductionKind({
      applies_to_promotion_arrears: false,
      promotion_arrears_basis: 'gross',
    })).toBeNull();
  });

  it('honors an explicitly zero basic portion and preserves legacy fallback for old arrears rows', () => {
    expect((service as any).getArrearBasicAmount({
      total_arrears: 50000,
      details: [{ amount: 50000, basic_amount: 0 }],
    })).toBe(0);
    expect((service as any).getArrearBasicAmount({
      total_arrears: 50000,
      details: [{ amount: 50000 }],
    })).toBe(50000);
  });
});
