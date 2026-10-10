const VARIANT_CLASSES = {
  neutral: 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
};

const STATUS_VARIANT = {
  active: 'brand',
  processing: 'warning',
  completed: 'success',
  terminated: 'neutral',
  error: 'danger',
  idle: 'neutral',
  initializing: 'neutral',
  suspended: 'warning',
  deleted: 'danger'
};

export function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge variant={STATUS_VARIANT[status] || 'neutral'}>{status}</Badge>;
}
