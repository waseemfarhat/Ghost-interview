import { useInView } from '../../hooks/useInView';

/**
 * Wraps children in a scroll-triggered fade/slide-in entrance animation.
 * `as` controls the rendered element; `delay` staggers siblings.
 */
export function Reveal({ children, as: Tag = 'div', delay = 0, className = '', from = 'up', ...props }) {
  const [ref, inView] = useInView();

  const hiddenTransform =
    from === 'up' ? 'translateY(24px)' : from === 'left' ? 'translateX(24px)' : 'translateX(-24px)';

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : hiddenTransform,
        transition: 'opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)',
        transitionDelay: `${delay}ms`,
        willChange: 'opacity, transform'
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
