type StoredRequestKey = {
  key: string;
  fingerprint: string;
};

const STORAGE_PREFIX = 'jsc:idempotency:v1:';
const inFlightKeyLookups = new Map<string, Promise<StoredRequestKey>>();
const memoryRequestKeys = new Map<string, StoredRequestKey>();

function stableDigest(value: string): string {
  // Deterministic fallback for browsers without Web Crypto.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

async function digest(value: string): Promise<string> {
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return stableDigest(value);
}

function createKey(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function getRequestIdempotencyUserContext(): string {
  try {
    const rawUser = localStorage.getItem('jsc_current_user') || localStorage.getItem('jsc_user') || '';
    if (!rawUser) return '';
    try {
      const user = JSON.parse(rawUser);
      return String(user?.id || user?.userId || user?.staff_id || user?.email || '');
    } catch {
      return rawUser;
    }
  } catch {
    return '';
  }
}

export async function getRequestIdempotencyKey(
  endpoint: string,
  method: string,
  body: BodyInit | null | undefined,
  userContext = '',
): Promise<{ key: string; storageKey: string }> {
  const signature = `${method.toUpperCase()}\n${endpoint}\n${userContext}\n${typeof body === 'string' ? body : ''}`;
  const fingerprint = await digest(signature);
  const storageKey = `${STORAGE_PREFIX}${fingerprint}`;
  const storage = getStorage();

  const memoryRecord = memoryRequestKeys.get(storageKey);
  if (memoryRecord?.fingerprint === fingerprint) return { key: memoryRecord.key, storageKey };

  let existingValue: string | null = null;
  try {
    existingValue = storage?.getItem(storageKey) || null;
  } catch {
    // Continue with an in-memory key if browser storage is unavailable.
  }
  if (existingValue) {
    try {
      const existing = JSON.parse(existingValue) as StoredRequestKey;
      if (existing.fingerprint === fingerprint && existing.key) {
        memoryRequestKeys.set(storageKey, existing);
        return { key: existing.key, storageKey };
      }
    } catch {
      try { storage?.removeItem(storageKey); } catch { /* storage is optional */ }
    }
  }

  let pendingLookup = inFlightKeyLookups.get(storageKey);
  if (!pendingLookup) {
    pendingLookup = Promise.resolve({ key: createKey(), fingerprint });
    inFlightKeyLookups.set(storageKey, pendingLookup);
  }
  const record = await pendingLookup;
  memoryRequestKeys.set(storageKey, record);
  try { storage?.setItem(storageKey, JSON.stringify(record)); } catch { /* storage is optional */ }
  inFlightKeyLookups.delete(storageKey);
  return { key: record.key, storageKey };
}

export function clearRequestIdempotencyKey(storageKey: string, key: string): void {
  if (memoryRequestKeys.get(storageKey)?.key === key) memoryRequestKeys.delete(storageKey);
  const storage = getStorage();
  if (!storage) return;
  try {
    const stored = JSON.parse(storage.getItem(storageKey) || 'null') as StoredRequestKey | null;
    if (stored?.key === key) storage.removeItem(storageKey);
  } catch {
    try { storage.removeItem(storageKey); } catch { /* storage is optional */ }
  }
}
