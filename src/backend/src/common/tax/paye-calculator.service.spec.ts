import { PayeCalculatorService } from './paye-calculator.service';

describe('PayeCalculatorService one-off arrears tax', () => {
  let service: PayeCalculatorService;

  beforeEach(() => {
    service = new PayeCalculatorService();
  });

  const taxConfig = {
    tax_brackets: [{ min: 0, max: null, rate: 20 }],
  };

  it('taxes a one-off arrears amount once against projected annual pay', () => {
    const additionalTax = service.calculateOneOffAdditionalTax(
      {
        grossPay: 100000,
        allowances: [],
        isContractStaff: false,
        pensionDeduction: 0,
        nhfDeduction: 0,
        nhisDeduction: 0,
      },
      120000,
      {},
      taxConfig,
    );

    expect(additionalTax).toBe(24000);
  });

  it('applies eligible arrears reliefs once when calculating incremental tax', () => {
    const additionalTax = service.calculateOneOffAdditionalTax(
      {
        grossPay: 100000,
        allowances: [],
        isContractStaff: false,
        pensionDeduction: 0,
        nhfDeduction: 0,
        nhisDeduction: 0,
      },
      120000,
      { pension: 6000, nhf: 3000, nhis: 3000 },
      taxConfig,
    );

    expect(additionalTax).toBe(21600);
  });

  it('calculates a new employee arrears tax without annualizing arrears as recurring income', () => {
    const additionalTax = service.calculateOneOffAdditionalTax(
      {
        grossPay: 0,
        allowances: [],
        isContractStaff: false,
        pensionDeduction: 0,
        nhfDeduction: 0,
        nhisDeduction: 0,
      },
      120000,
      {},
      taxConfig,
    );

    expect(additionalTax).toBe(24000);
  });

  it('returns no arrears tax when there is no manual arrears amount', () => {
    const additionalTax = service.calculateOneOffAdditionalTax(
      {
        grossPay: 100000,
        allowances: [],
        isContractStaff: false,
        pensionDeduction: 0,
        nhfDeduction: 0,
        nhisDeduction: 0,
      },
      0,
      {},
      taxConfig,
    );

    expect(additionalTax).toBe(0);
  });
});
