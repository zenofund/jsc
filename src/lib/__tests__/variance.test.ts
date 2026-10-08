import { describe, expect, it } from 'vitest';
import { getVarianceDelta } from '../variance';

describe('getVarianceDelta', () => {
  it('returns zero when there is no earlier source to compare', () => {
    expect(getVarianceDelta(15000, undefined)).toBe(0);
    expect(getVarianceDelta(15000, null)).toBe(0);
    expect(getVarianceDelta(undefined, 12000)).toBe(0);
  });

  it('returns the difference when both values exist', () => {
    expect(getVarianceDelta(15000, 12000)).toBe(3000);
    expect(getVarianceDelta(12000, 15000)).toBe(-3000);
  });
});
