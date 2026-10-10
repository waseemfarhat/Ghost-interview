/**
 * Decorative animated aurora blooms used behind hero / auth / interview
 * surfaces. Purely visual, pointer-events-none, aria-hidden.
 * `variant` picks a placement preset.
 */
export function Aurora({ variant = 'hero' }) {
  if (variant === 'hero') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="gi-aurora gi-aurora-1 -left-24 -top-24 h-80 w-80" />
        <div className="gi-aurora gi-aurora-2 right-0 top-10 h-72 w-72" />
        <div className="gi-aurora gi-aurora-3 bottom-0 left-1/3 h-64 w-64" />
      </div>
    );
  }
  if (variant === 'corner') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="gi-aurora gi-aurora-1 -right-20 -top-20 h-72 w-72" />
        <div className="gi-aurora gi-aurora-2 -bottom-24 -left-16 h-64 w-64" />
      </div>
    );
  }
  return null;
}
