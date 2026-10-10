import { useEffect, useState } from 'react';
import { useCountUp } from '../../hooks/useCountUp';

/**
 * Animated circular progress ring with a gradient stroke and a count-up
 * number in the center. Used for overall readiness and score visualizations.
 *
 * props:
 *  - value: current number
 *  - max:   maximum (default 100). For a 0..10 readiness score pass max={10}.
 *  - size:  px diameter (default 140)
 *  - label: small caption under the number
 *  - gradientId: unique id so multiple rings don't share a gradient def
 */
export function ProgressRing({ value, max = 100, size = 140, label, gradientId, decimals = 0 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeMax = Number(max) || 100;
  const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / safeMax));
  const [mounted, setMounted] = useState(false);
  const { ref, display } = useCountUp(value, { decimals });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const gid = gradientId || `ring-${Math.random().toString(36).slice(2)}`;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label || 'Score'}: ${value} out of ${safeMax}`}>
          <defs>
            <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand-500)" />
              <stop offset="60%" stopColor="#a06bff" />
              <stop offset="100%" stopColor="var(--color-accent-500)" />
            </linearGradient>
          </defs>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={mounted ? circumference * (1 - ratio) : circumference}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-[var(--color-text)]">
            {display}
            <span className="text-base font-medium text-[var(--color-text-muted)]">/{safeMax}</span>
          </span>
        </div>
      </div>
      {label && <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>}
    </div>
  );
}
