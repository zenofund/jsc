
export const formatCurrency = (amount: number | string | undefined | null): string => {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (val === undefined || val === null || isNaN(val)) return '₦0.00';
  
  // Use en-NG locale for Naira formatting
  // This will typically output "₦1,234.56"
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatNumber = (amount: number | string | undefined | null): string => {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (val === undefined || val === null || isNaN(val)) return '0';
  
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatCompactCurrency = (amount: number | string | undefined | null) => {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (val === undefined || val === null || isNaN(val)) return { short: '₦0.00', full: '₦0.00' };

  const absVal = Math.abs(val);
  const full = formatCurrency(val);

  if (absVal >= 1_000_000_000) {
    return {
      short: `₦${(val / 1_000_000_000).toFixed(2)}B`,
      full: full
    };
  } else if (absVal >= 1_000_000) {
    return {
      short: `₦${(val / 1_000_000).toFixed(2)}M`,
      full: full
    };
  }

  return { short: full, full: full };
};
