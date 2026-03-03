// =====================================================
// Nigerian Banks & Financial Institutions
// =====================================================
// Official list of Nigerian commercial banks with CBN codes
// Used for bank validation and payment processing
// =====================================================

export interface NigerianBank {
  name: string;
  code: string; // CBN code
  sortCode?: string;
  nibssCode?: string;
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: 'Access Bank', code: '044', nibssCode: '000014' },
  { name: 'Citibank', code: '023', nibssCode: '000009' },
  { name: 'Ecobank Nigeria', code: '050', nibssCode: '000010' },
  { name: 'Fidelity Bank', code: '070', nibssCode: '000007' },
  { name: 'First Bank of Nigeria', code: '011', nibssCode: '000016' },
  { name: 'First City Monument Bank (FCMB)', code: '214', nibssCode: '000003' },
  { name: 'Globus Bank', code: '00103', nibssCode: '000027' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', nibssCode: '000013' },
  { name: 'Heritage Bank', code: '030', nibssCode: '000020' },
  { name: 'Keystone Bank', code: '082', nibssCode: '000002' },
  { name: 'Polaris Bank', code: '076', nibssCode: '000008' },
  { name: 'Providus Bank', code: '101', nibssCode: '000023' },
  { name: 'Stanbic IBTC Bank', code: '221', nibssCode: '000012' },
  { name: 'Standard Chartered Bank', code: '068', nibssCode: '000021' },
  { name: 'Sterling Bank', code: '232', nibssCode: '000001' },
  { name: 'Titan Trust Bank', code: '102', nibssCode: '000025' },
  { name: 'Union Bank of Nigeria', code: '032', nibssCode: '000018' },
  { name: 'United Bank for Africa (UBA)', code: '033', nibssCode: '000004' },
  { name: 'Unity Bank', code: '215', nibssCode: '000011' },
  { name: 'Wema Bank', code: '035', nibssCode: '000017' },
  { name: 'Zenith Bank', code: '057', nibssCode: '000015' },
];

// Helper function to get bank by code
export function getBankByCode(code: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => bank.code === code);
}

// Helper function to get bank by name
export function getBankByName(name: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find(bank => 
    bank.name.toLowerCase().includes(name.toLowerCase())
  );
}

// Helper function to validate bank code
export function isValidBankCode(code: string): boolean {
  return NIGERIAN_BANKS.some(bank => bank.code === code);
}
