const variants = {
  primary:
    'gi-btn-gradient text-white shadow-lg shadow-brand-600/25 hover:shadow-brand-600/35 disabled:shadow-none disabled:opacity-60',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300 hover:-translate-y-0.5 disabled:hover:translate-y-0',
  danger:
    'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/35 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:opacity-60',
  ghost: 'bg-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]'
};

const sizes = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base'
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

