import React, { useState, useCallback } from 'react';
import { formatNumber, parseFormattedNumber } from '../utils/format';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  prefix,
  suffix,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseFormattedNumber(e.target.value);
    onChange(num);
  }, [onChange]);

  const displayValue = isFocused 
    ? (value !== 0 ? value.toString() : '') 
    : (value !== 0 ? formatNumber(value) : '');

  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
        className={`w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>}
    </div>
  );
};
