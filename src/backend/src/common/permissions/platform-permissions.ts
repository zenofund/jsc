export const PLATFORM_PERMISSION_KEYS = [
  'user.account.read',
  'user.account.create',
  'user.account.update',
  'user.account.delete',
  'settings.manage',
  'audit.read',
  'profile.read',
] as const;

const platformPermissionKeys = new Set<string>(PLATFORM_PERMISSION_KEYS);

export function isPlatformPermissionKey(permissionKey: unknown): boolean {
  return platformPermissionKeys.has(String(permissionKey || '').trim().toLowerCase());
}
