import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function generateTotp(secretBase32: string, counter: number, digits: number): string {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, '0');
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function buildOtpAuthUrl(params: { issuer: string; account: string; secret: string }) {
  const issuer = String(params.issuer || '').trim() || 'JSC Payroll';
  const account = String(params.account || '').trim();
  const secret = String(params.secret || '').trim();
  const label = encodeURIComponent(`${issuer}:${account}`);
  const qs = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${qs.toString()}`;
}

export function verifyTotp(params: { secret: string; token: string; window?: number; stepSeconds?: number; digits?: number }) {
  const secret = String(params.secret || '').trim();
  const token = String(params.token || '').trim();
  if (!secret || !/^\d{6}$/.test(token)) return false;

  const stepSeconds = Number.isFinite(Number(params.stepSeconds)) ? Number(params.stepSeconds) : 30;
  const digits = Number.isFinite(Number(params.digits)) ? Number(params.digits) : 6;
  const window = Number.isFinite(Number(params.window)) ? Number(params.window) : 1;
  const nowCounter = Math.floor(Date.now() / 1000 / stepSeconds);

  for (let drift = -window; drift <= window; drift += 1) {
    const expected = generateTotp(secret, nowCounter + drift, digits);
    if (expected === token) return true;
  }

  return false;
}

