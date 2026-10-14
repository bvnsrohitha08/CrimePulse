import React from 'react';
import { cn } from '../../utils/cn';

export function Input({ className, type = 'text', disabled, ...props }) {
  return (
    <input
      type={type}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
}
