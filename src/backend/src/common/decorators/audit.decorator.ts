import { SetMetadata } from '@nestjs/common';

export const AUDIT_META_KEY = 'audit_meta';

export interface AuditMetadata {
  table?: string;
  action?: string;
  description?: string;
}

export const Audit = (meta: AuditMetadata) => SetMetadata(AUDIT_META_KEY, meta);
