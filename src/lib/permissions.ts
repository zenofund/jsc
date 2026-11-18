import type { User } from '../types/entities';

export function hasPermission(user: Pick<User, 'permissions'> | null | undefined, permission: string) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}
