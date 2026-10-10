export function Spinner({ size = 24, className = '' }) {
  return (
    <svg
      className={`${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      style={{ animation: 'gi-ring 0.9s linear infinite' }}
    >
      <circle className="opacity-15" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        stroke="url(#gi-spinner-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        d="M12 2a10 10 0 0110 10"
      />
      <defs>
        <linearGradient id="gi-spinner-grad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="var(--color-brand-500)" />
          <stop offset="100%" stopColor="var(--color-accent-500)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FullPageSpinner() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center gap-4 overflow-hidden bg-[var(--color-surface-alt)]">
      <div className="gi-aurora gi-aurora-1 -left-20 top-10 h-64 w-64" />
      <div className="gi-aurora gi-aurora-2 -right-16 bottom-10 h-56 w-56" />
      <div className="gi-bob flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white gi-glow">
        GI
      </div>
      <Spinner size={22} className="text-brand-500" />
      <p className="text-sm font-medium text-[var(--color-text-muted)]">Loading Ghost Interview…</p>
    </div>
  );
}

