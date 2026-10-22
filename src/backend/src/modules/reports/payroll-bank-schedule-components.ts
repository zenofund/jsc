export type PayrollBankScheduleComponentColumn = {
  key: string;
  label: string;
};

const DEDUCTION_COMPONENTS = [
  { key: 'deduction_tax', label: 'Tax', codes: ['TAX', 'PAYE'] },
  { key: 'deduction_pension', label: 'Pension', codes: ['PENSION'] },
  { key: 'deduction_union', label: 'Union', codes: ['UNION'] },
  { key: 'deduction_nhf', label: 'NHF', codes: ['NHF'] },
  { key: 'deduction_nhia', label: 'NHIA', codes: ['NHIA', 'NHIS'] },
  { key: 'deduction_jsc_coop', label: 'JSC Coop', codes: ['JSCCOOP'] },
  { key: 'deduction_hc_coop', label: 'HC Coop', codes: ['HCCOOP'] },
  { key: 'deduction_mfc', label: 'MFC', codes: ['MFC', 'MFCCOOP'] },
] as const;

const AMOUNT_COMPONENTS: PayrollBankScheduleComponentColumn[] = [
  { key: 'basic_salary', label: 'Basic' },
  { key: 'arrears', label: 'Arrears' },
  ...DEDUCTION_COMPONENTS.map(({ key, label }) => ({ key, label })),
];

const toAmount = (value: unknown): number => {
  const amount = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(amount) ? amount : 0;
};

const toItems = (value: unknown): Array<Record<string, unknown>> => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
};

const normalizeToken = (value: unknown) =>
  String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const sumMatchingDeductions = (
  deductions: Array<Record<string, unknown>>,
  codes: readonly string[],
  nameMatch: (name: string) => boolean,
) =>
  deductions.reduce((sum, item) => {
    const tokens = [
      item.code,
      item.source_code,
      item.deduction_code,
      item.remittance_key,
    ].map(normalizeToken);
    const name = normalizeToken(item.name ?? item.deduction_name);
    return tokens.some((token) => codes.includes(token)) || nameMatch(name)
      ? sum + toAmount(item.amount)
      : sum;
  }, 0);

export function getPayrollBankScheduleComponents(line: {
  basic_salary?: unknown;
  allowances?: unknown;
  deductions?: unknown;
}) {
  const allowances = toItems(line.allowances);
  const deductions = toItems(line.deductions);
  const components: Record<string, number> = {
    basic_salary: toAmount(line.basic_salary),
    arrears: allowances.reduce((sum, item) => {
      const code = normalizeToken(item.code ?? item.allowance_code);
      const name = normalizeToken(item.name ?? item.allowance_name);
      return code === 'ARREAR' || name.startsWith('ARREAR')
        ? sum + toAmount(item.amount)
        : sum;
    }, 0),
  };

  for (const component of DEDUCTION_COMPONENTS) {
    components[component.key] = sumMatchingDeductions(
      deductions,
      component.codes,
      (name) => {
        if (component.key === 'deduction_tax') return name.includes('PAYE') || name.includes('TAX');
        if (component.key === 'deduction_pension') return name.includes('PENSION');
        if (component.key === 'deduction_union') return name.includes('UNION');
        if (component.key === 'deduction_nhf') return name === 'NHF' || name.includes('NATIONALHOUSINGFUND');
        if (component.key === 'deduction_nhia') return name.includes('NHIA') || name.includes('NHIS');
        if (component.key === 'deduction_jsc_coop') return name.includes('JSC') && name.includes('COOP');
        if (component.key === 'deduction_hc_coop') return name.includes('HC') && name.includes('COOP');
        return name.includes('MFC') && name.includes('COOP');
      },
    );
  }

  return components;
}

export function getActivePayrollBankScheduleComponentColumns(
  lines: Array<Record<string, unknown>>,
): PayrollBankScheduleComponentColumn[] {
  const lineComponents = lines.map(getPayrollBankScheduleComponents);
  return AMOUNT_COMPONENTS.filter(({ key }) =>
    lineComponents.some((components) => Math.abs(components[key] || 0) > 0),
  );
}
