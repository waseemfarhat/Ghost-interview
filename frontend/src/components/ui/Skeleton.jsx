/** Shimmer skeleton block for loading states. */
export function Skeleton({ className = '', rounded = 'rounded-lg' }) {
  return <div className={`gi-skeleton ${rounded} ${className}`} aria-hidden="true" />;
}

/** A card-shaped skeleton used while data loads. */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
    </div>
  );
}
