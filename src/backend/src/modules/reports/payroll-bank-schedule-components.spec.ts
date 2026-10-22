import {
  getActivePayrollBankScheduleComponentColumns,
  getPayrollBankScheduleComponents,
} from './payroll-bank-schedule-components';

describe('payroll-bank-schedule-components', () => {
  it('combines promotion and manual arrears in one amount and groups arrears deductions by setup code', () => {
    const components = getPayrollBankScheduleComponents({
      basic_salary: '1000',
      allowances: [
        { code: 'ARREAR', name: 'Arrear: promotion', amount: 125 },
        { code: 'ARREAR', name: 'Arrear: salary_adjustment', amount: 75 },
        { code: 'CONS', name: 'Consolidated All.', amount: 200 },
      ],
      deductions: [
        { code: 'TAX', name: 'PAYE Tax', amount: 20 },
        { code: 'PENSION', name: 'Pension', amount: 30 },
        { code: 'PENSION_MANUAL_ARREARS', source_code: 'PENSION', amount: 4 },
        { code: 'UNION', name: 'Union Due', amount: 5 },
        { code: 'NHF', name: 'NHF', amount: 6 },
        { code: 'NHIA', name: '\tNHIA', amount: 7 },
        { code: 'JSCCOOP', name: 'JSC COOP', amount: 8 },
        { code: 'HCCOOP', name: 'HC COOP', amount: 9 },
        { code: 'MFC', name: 'MFC COOP', amount: 10 },
      ],
    });

    expect(components).toEqual({
      basic_salary: 1000,
      arrears: 200,
      deduction_tax: 20,
      deduction_pension: 34,
      deduction_union: 5,
      deduction_nhf: 6,
      deduction_nhia: 7,
      deduction_jsc_coop: 8,
      deduction_hc_coop: 9,
      deduction_mfc: 10,
    });
  });

  it('only exposes columns with non-zero amounts in the selected payroll lines', () => {
    const columns = getActivePayrollBankScheduleComponentColumns([
      {
        basic_salary: 100,
        allowances: [{ code: 'ARREAR', name: 'Arrear: promotion', amount: 0 }],
        deductions: [{ code: 'TAX', name: 'PAYE Tax', amount: 0 }],
      },
      {
        basic_salary: 0,
        allowances: [{ code: 'ARREAR', name: 'Arrear: salary_adjustment', amount: 25 }],
        deductions: [{ code: 'NHIA', name: 'NHIA', amount: 5 }],
      },
    ]);

    expect(columns).toEqual([
      { key: 'basic_salary', label: 'Basic' },
      { key: 'arrears', label: 'Arrears' },
      { key: 'deduction_nhia', label: 'NHIA' },
    ]);
  });
});
