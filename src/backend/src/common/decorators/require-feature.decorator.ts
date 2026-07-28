import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURE_KEY = 'required_feature_key';

export type AppFeatureKey = 'loan_management' | 'cooperative_management';

export const RequireFeature = (feature: AppFeatureKey) =>
  SetMetadata(REQUIRED_FEATURE_KEY, feature);
