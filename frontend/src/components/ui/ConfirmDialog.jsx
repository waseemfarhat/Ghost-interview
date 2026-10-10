import { Button } from './Button';

export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', variant = 'danger', isLoading, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="gi-fade-in fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
      <div
        className="gi-scale-in relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl shadow-brand-900/20"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
        {description && <p className="mt-2 text-sm text-[var(--color-text-muted)]">{description}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

