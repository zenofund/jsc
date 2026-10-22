import {
  bankNameMatchesCode,
  getCanonicalBankName,
  getSupportedBanksByCode,
} from './bank-catalog';

describe('bank-catalog', () => {
  it('resolves bank names from authoritative codes', () => {
    expect(getCanonicalBankName('011')).toBe('First Bank of Nigeria');
    expect(getCanonicalBankName('033')).toBe('United Bank for Africa (UBA)');
    expect(getCanonicalBankName('058')).toBe('Guaranty Trust Bank (GTBank)');
  });

  it('accepts known aliases while retaining the canonical name', () => {
    expect(bankNameMatchesCode('First Bank Of Nigeria', '011')).toBe(true);
    expect(bankNameMatchesCode('UBA', '033')).toBe(true);
    expect(bankNameMatchesCode('Stanbic Ibtc Bank', '221')).toBe(true);
  });

  it('does not guess unknown or conflicting bank codes', () => {
    expect(getCanonicalBankName('562')).toBeNull();
    expect(getCanonicalBankName('000')).toBeNull();
    expect(getCanonicalBankName('999')).toBeNull();
  });

  it('omits unresolved bank codes from supported bank choices', () => {
    const supportedBanks = getSupportedBanksByCode();
    expect(supportedBanks.some((bank) => bank.code === '562')).toBe(false);
    expect(supportedBanks.some((bank) => bank.code === '000')).toBe(false);
    expect(new Set(supportedBanks.map((bank) => bank.code)).size).toBe(supportedBanks.length);
  });
});
