export type FeatureToggleKey = 'loan' | 'cooperative';

export function isFeatureDisabledError(error: unknown, feature?: FeatureToggleKey): boolean {
  const message = String((error as any)?.message || '').trim().toLowerCase();
  if (!message) return false;

  if (feature === 'loan') {
    return message.includes('loan management is currently disabled');
  }

  if (feature === 'cooperative') {
    return message.includes('cooperative management is currently disabled');
  }

  return message.includes('currently disabled by admin settings');
}

