import { useInView } from '../../hooks/useInView';

const EMOTION_COLORS = {
  happy: '#22c55e',
  neutral: '#8b74ff',
  confused: '#f59e0b',
  anxious: '#f97316',
  angry: '#ef4444',
  sad: '#3b82f6',
  surprised: '#ec4899'
};

export function EmotionDonut({ distribution }) {
  const entries = Object.entries(distribution || {}).filter(([, pct]) => pct > 0);
  const [ref, inView] = useInView();

  if (!entries.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">No facial emotion data was recorded.</p>;
  }

  let cumulative = 0;
  const stops = entries.map(([label, pct]) => {
    const start = cumulative;
    cumulative += pct;
    return `${EMOTION_COLORS[label] || '#999'} ${start}% ${cumulative}%`;
  });

  const dominant = entries.sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex items-center gap-6">
      <div ref={ref} className="relative shrink-0">
        <div
          className="gi-scale-in h-32 w-32 rounded-full transition-transform"
          style={{
            background: `conic-gradient(${stops.join(', ')})`,
            transform: inView ? 'scale(1)' : 'scale(0.85)',
            transition: 'transform 0.7s cubic-bezier(0.22,1,0.36,1)'
          }}
          role="img"
          aria-label="Facial emotion distribution during the interview"
        />
        {/* Donut hole */}
        <div className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-[var(--color-surface)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold capitalize text-[var(--color-text)]">{dominant[0]}</span>
          <span className="text-xs text-[var(--color-text-muted)]">{dominant[1]}%</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {entries.map(([label, pct]) => (
          <li key={label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: EMOTION_COLORS[label] || '#999' }} />
            <span className="capitalize text-[var(--color-text)]">{label}</span>
            <span className="text-[var(--color-text-muted)]">{pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

