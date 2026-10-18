import React from 'react';
import { formatCompactCurrency } from '../utils/format';

interface CompactAmountProps {
  amount?: number | string | null;
  className?: string;
}

export function CompactAmount({ amount, className = '' }: CompactAmountProps) {
  const sourceAmount = amount ?? 0;
  const parsedAmount = typeof sourceAmount === 'number'
    ? sourceAmount
    : Number(String(sourceAmount).replace(/[^\d.-]/g, ''));

  if (!Number.isFinite(parsedAmount)) return <>{sourceAmount}</>;

  const { short, full } = formatCompactCurrency(parsedAmount);
  if (Math.abs(parsedAmount) < 1_000_000) return <>{full}</>;

  return (
    <span className={`inline-flex flex-col whitespace-nowrap leading-tight ${className}`.trim()}>
      <span className="font-medium">{short}</span>
      <span className="mt-0.5 text-[0.7rem] font-normal text-muted-foreground">{full}</span>
    </span>
  );
}
