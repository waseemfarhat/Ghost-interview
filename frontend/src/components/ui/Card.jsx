export function Card({ children, className = '', hover = false, glass = false, gradientBorder = false, ...props }) {
  const base = glass
    ? 'gi-glass rounded-2xl shadow-lg shadow-brand-900/5'
    : 'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-brand-900/[0.03]';
  const interactive = hover ? 'gi-lift' : '';
  const border = gradientBorder ? 'gi-gradient-border' : '';
  return (
    <div className={`${base} ${interactive} ${border} ${className}`} {...props}>
      {children}
    </div>
  );
}

