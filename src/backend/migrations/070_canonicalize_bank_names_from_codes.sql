WITH canonical_bank_names(bank_code, bank_name) AS (
  VALUES
    ('011', 'First Bank of Nigeria'),
    ('023', 'Citibank'),
    ('030', 'Heritage Bank'),
    ('032', 'Union Bank of Nigeria'),
    ('033', 'United Bank for Africa (UBA)'),
    ('035', 'Wema Bank'),
    ('044', 'Access Bank'),
    ('050', 'Ecobank Nigeria'),
    ('057', 'Zenith Bank'),
    ('058', 'Guaranty Trust Bank (GTBank)'),
    ('063', 'Access Bank (Diamond)'),
    ('068', 'Standard Chartered Bank'),
    ('070', 'Fidelity Bank'),
    ('076', 'Polaris Bank'),
    ('082', 'Keystone Bank'),
    ('100', 'Suntrust Bank'),
    ('101', 'Providus Bank'),
    ('102', 'Titan Trust Bank'),
    ('125', 'Rubies MFB'),
    ('214', 'First City Monument Bank (FCMB)'),
    ('215', 'Unity Bank'),
    ('221', 'Stanbic IBTC Bank'),
    ('232', 'Sterling Bank'),
    ('301', 'Jaiz Bank'),
    ('302', 'Taj Bank'),
    ('303', 'Lotus Bank'),
    ('401', 'Aso Savings and Loans'),
    ('526', 'Parallex Bank'),
    ('559', 'Coronation Merchant Bank'),
    ('566', 'VFD Microfinance Bank'),
    ('00103', 'Globus Bank'),
    ('100004', 'Opay'),
    ('100033', 'Palmpay'),
    ('50304', 'Mint Finex MFB'),
    ('50383', 'Hasal Microfinance Bank'),
    ('50515', 'Moniepoint Microfinance Bank'),
    ('50549', 'Links Microfinance Bank'),
    ('50563', 'Mayfair Microfinance Bank'),
    ('50823', 'Cemcs Microfinance Bank'),
    ('50931', 'Bowen Microfinance Bank'),
    ('51251', 'Hackman Microfinance Bank'),
    ('51269', 'Tangerine Money'),
    ('51310', 'Sparkle Microfinance Bank')
)
UPDATE staff s
SET bank_code = names.bank_code,
    bank_name = names.bank_name
FROM canonical_bank_names names
WHERE names.bank_code = COALESCE(
  NULLIF(BTRIM(s.bank_code), ''),
  (SELECT NULLIF(BTRIM(bg.bank_code), '') FROM bank_groups bg WHERE bg.id = s.bank_group_id)
)
AND (
  s.bank_code IS DISTINCT FROM names.bank_code
  OR s.bank_name IS DISTINCT FROM names.bank_name
);

WITH canonical_bank_names(bank_code, bank_name) AS (
  VALUES
    ('011', 'First Bank of Nigeria'),
    ('023', 'Citibank'),
    ('030', 'Heritage Bank'),
    ('032', 'Union Bank of Nigeria'),
    ('033', 'United Bank for Africa (UBA)'),
    ('035', 'Wema Bank'),
    ('044', 'Access Bank'),
    ('050', 'Ecobank Nigeria'),
    ('057', 'Zenith Bank'),
    ('058', 'Guaranty Trust Bank (GTBank)'),
    ('063', 'Access Bank (Diamond)'),
    ('068', 'Standard Chartered Bank'),
    ('070', 'Fidelity Bank'),
    ('076', 'Polaris Bank'),
    ('082', 'Keystone Bank'),
    ('100', 'Suntrust Bank'),
    ('101', 'Providus Bank'),
    ('102', 'Titan Trust Bank'),
    ('125', 'Rubies MFB'),
    ('214', 'First City Monument Bank (FCMB)'),
    ('215', 'Unity Bank'),
    ('221', 'Stanbic IBTC Bank'),
    ('232', 'Sterling Bank'),
    ('301', 'Jaiz Bank'),
    ('302', 'Taj Bank'),
    ('303', 'Lotus Bank'),
    ('401', 'Aso Savings and Loans'),
    ('526', 'Parallex Bank'),
    ('559', 'Coronation Merchant Bank'),
    ('566', 'VFD Microfinance Bank'),
    ('00103', 'Globus Bank'),
    ('100004', 'Opay'),
    ('100033', 'Palmpay'),
    ('50304', 'Mint Finex MFB'),
    ('50383', 'Hasal Microfinance Bank'),
    ('50515', 'Moniepoint Microfinance Bank'),
    ('50549', 'Links Microfinance Bank'),
    ('50563', 'Mayfair Microfinance Bank'),
    ('50823', 'Cemcs Microfinance Bank'),
    ('50931', 'Bowen Microfinance Bank'),
    ('51251', 'Hackman Microfinance Bank'),
    ('51269', 'Tangerine Money'),
    ('51310', 'Sparkle Microfinance Bank')
)
UPDATE bank_groups groups
SET bank_name = names.bank_name,
    bank_code = names.bank_code
FROM canonical_bank_names names
WHERE BTRIM(groups.bank_code) = names.bank_code
AND groups.bank_name IS DISTINCT FROM names.bank_name;

WITH canonical_bank_names(bank_code, bank_name) AS (
  VALUES
    ('011', 'First Bank of Nigeria'),
    ('023', 'Citibank'),
    ('030', 'Heritage Bank'),
    ('032', 'Union Bank of Nigeria'),
    ('033', 'United Bank for Africa (UBA)'),
    ('035', 'Wema Bank'),
    ('044', 'Access Bank'),
    ('050', 'Ecobank Nigeria'),
    ('057', 'Zenith Bank'),
    ('058', 'Guaranty Trust Bank (GTBank)'),
    ('063', 'Access Bank (Diamond)'),
    ('068', 'Standard Chartered Bank'),
    ('070', 'Fidelity Bank'),
    ('076', 'Polaris Bank'),
    ('082', 'Keystone Bank'),
    ('100', 'Suntrust Bank'),
    ('101', 'Providus Bank'),
    ('102', 'Titan Trust Bank'),
    ('125', 'Rubies MFB'),
    ('214', 'First City Monument Bank (FCMB)'),
    ('215', 'Unity Bank'),
    ('221', 'Stanbic IBTC Bank'),
    ('232', 'Sterling Bank'),
    ('301', 'Jaiz Bank'),
    ('302', 'Taj Bank'),
    ('303', 'Lotus Bank'),
    ('401', 'Aso Savings and Loans'),
    ('526', 'Parallex Bank'),
    ('559', 'Coronation Merchant Bank'),
    ('566', 'VFD Microfinance Bank'),
    ('00103', 'Globus Bank'),
    ('100004', 'Opay'),
    ('100033', 'Palmpay'),
    ('50304', 'Mint Finex MFB'),
    ('50383', 'Hasal Microfinance Bank'),
    ('50515', 'Moniepoint Microfinance Bank'),
    ('50549', 'Links Microfinance Bank'),
    ('50563', 'Mayfair Microfinance Bank'),
    ('50823', 'Cemcs Microfinance Bank'),
    ('50931', 'Bowen Microfinance Bank'),
    ('51251', 'Hackman Microfinance Bank'),
    ('51269', 'Tangerine Money'),
    ('51310', 'Sparkle Microfinance Bank')
)
UPDATE bank_accounts accounts
SET bank_name = names.bank_name,
    bank_code = names.bank_code
FROM canonical_bank_names names
WHERE BTRIM(accounts.bank_code) = names.bank_code
AND accounts.bank_name IS DISTINCT FROM names.bank_name;

-- Code 562 and placeholder code 000 are intentionally not rewritten: 562 has
-- conflicting bank-name mappings and 000 is not a uniquely identified bank.
