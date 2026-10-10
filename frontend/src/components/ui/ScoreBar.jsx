import { useInView } from '../../hooks/useInView';

export function ScoreBar({ label, value, max = 100, suffix = '%', color }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const [ref, inView] = useInView();
  const barColor = color || 'var(--color-brand-500)';

  return (
    <div ref={ref}>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-semibold text-[var(--color-text)]">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: inView ? `${pct}%` : '0%',
            backgroundImage: `linear-gradient(90deg, ${barColor}, color-mix(in srgb, ${barColor} 55%, #ffffff))`,
            transitionDuration: '1.2s',
            transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)'
          }}
        />
      </div>
    </div>
  );
}

