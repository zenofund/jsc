import { SetMetadata } from '@nestjs/common';

export const NO_ADMIN_BYPASS_KEY = 'no_admin_bypass';

export const NoAdminBypass = () => SetMetadata(NO_ADMIN_BYPASS_KEY, true);
