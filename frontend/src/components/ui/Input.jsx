import { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input(
  { label, error, hint, type = 'text', className = '', ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        type={type}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`focus-ring w-full rounded-xl border bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)] shadow-sm shadow-brand-900/[0.02] transition-all duration-200 placeholder:text-[var(--color-text-muted)] focus:border-brand-400 focus:ring-4 focus:ring-brand-500/12 ${
          error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-500/12'
            : 'border-[var(--color-border)]'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="gi-fade-up flex items-center gap-1.5 text-sm font-medium text-red-500">
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2zm0-4h-2V7h2z" />
          </svg>
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-sm text-[var(--color-text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
});
