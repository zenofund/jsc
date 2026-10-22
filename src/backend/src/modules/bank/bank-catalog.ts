import { NIGERIAN_BANKS } from '../../../../constants/banks';

export const BANK_SORT_CODES: Record<string, string> = {
  'access bank': '044',
  'access bank (diamond)': '063',
  alby: '000',
  'alat by wema': '035',
  'aso savings and loans': '401',
  'bowen microfinance bank': '50931',
  'cemcs microfinance bank': '50823',
  'citibank nigeria': '023',
  'coronation merchant bank': '559',
  'ecobank nigeria': '050',
  'ekondo microfinance bank': '562',
  'fbnquest merchant bank': '562',
  'fidelity bank': '070',
  'first bank of nigeria': '011',
  'first city monument bank': '214',
  fcmb: '214',
  'globus bank': '00103',
  'guaranty trust bank': '058',
  gtbank: '058',
  'hackman microfinance bank': '51251',
  'hasal microfinance bank': '50383',
  'heritage bank': '030',
  'jaiz bank': '301',
  'keystone bank': '082',
  'kuda bank': '50211',
  'links microfinance bank': '50549',
  'lotus bank': '303',
  'mayfair microfinance bank': '50563',
  'mint finex mfb': '50304',
  'moniepoint microfinance bank': '50515',
  opay: '100004',
  palmpay: '100033',
  'parallex bank': '526',
  'polaris bank': '076',
  'providus bank': '101',
  'rubies mfb': '125',
  'sparkle microfinance bank': '51310',
  'stanbic ibtc bank': '221',
  'standard chartered bank': '068',
  'sterling bank': '232',
  'suntrust bank': '100',
  'taj bank': '302',
  'tangerine money': '51269',
  'titan trust bank': '102',
  'union bank of nigeria': '032',
  'united bank for africa': '033',
  uba: '033',
  'unity bank': '215',
  'vfd microfinance bank': '566',
  'wema bank': '035',
  'zenith bank': '057',
};

const canonicalNamesByCode = new Map(
  NIGERIAN_BANKS.map((bank) => [bank.code, bank.name]),
);

const normalizeBankName = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const titleCaseBankName = (value: string) =>
  value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

export function getCanonicalBankName(bankCode: unknown): string | null {
  const code = String(bankCode ?? '').trim();
  if (!code || code === '000') return null;

  const canonicalName = canonicalNamesByCode.get(code);
  if (canonicalName) return canonicalName;

  const aliases = Object.entries(BANK_SORT_CODES)
    .filter(([, aliasCode]) => aliasCode === code)
    .map(([name]) => name);
  const distinctAliases = Array.from(new Set(aliases.map(normalizeBankName)));
  if (distinctAliases.length !== 1 || !aliases.length) return null;

  return titleCaseBankName(aliases[0]);
}

export function bankNameMatchesCode(bankName: unknown, bankCode: unknown): boolean {
  const normalizedName = normalizeBankName(bankName);
  const code = String(bankCode ?? '').trim();
  if (!normalizedName || !code) return false;

  const canonicalName = getCanonicalBankName(code);
  if (canonicalName && normalizeBankName(canonicalName) === normalizedName) return true;

  return Object.entries(BANK_SORT_CODES).some(
    ([alias, aliasCode]) =>
      aliasCode === code && normalizeBankName(alias) === normalizedName,
  );
}

export function getSupportedBanksByCode(): Array<{ name: string; code: string }> {
  const banksByCode = new Map<string, string>();
  for (const code of Object.values(BANK_SORT_CODES)) {
    const name = getCanonicalBankName(code);
    if (name && !banksByCode.has(code)) banksByCode.set(code, name);
  }
  return Array.from(banksByCode, ([code, name]) => ({ code, name })).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
}
