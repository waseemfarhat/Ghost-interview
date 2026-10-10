import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 to `target` with an ease-out curve once the
 * element scrolls into view. Respects prefers-reduced-motion (jumps straight
 * to the target). Used for dashboard/report stat numbers.
 */
export function useCountUp(target, { duration = 1200, decimals = 0 } = {}) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    const numericTarget = Number(target) || 0;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (prefersReduced) {
        setValue(numericTarget);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(numericTarget * eased);
        if (t < 1) requestAnimationFrame(tick);
        else setValue(numericTarget);
      };
      requestAnimationFrame(tick);
    };

    if (!node || typeof IntersectionObserver === 'undefined') {
      run();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, display: decimals > 0 ? value.toFixed(decimals) : Math.round(value) };
}
