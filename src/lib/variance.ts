export const getVarianceDelta = (
  currentValue?: number | string | null,
  previousValue?: number | string | null,
): number => {
  const normalize = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  if (currentValue === null || currentValue === undefined || previousValue === null || previousValue === undefined) {
    return 0;
  }

  return normalize(currentValue) - normalize(previousValue);
};
