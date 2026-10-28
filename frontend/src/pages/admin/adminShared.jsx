import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobRolesApi } from '../../api/jobRoles.api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

/**
 * Filters live in the URL so every analytics drill-down is linkable,
 * survives refresh, and works with the browser back button.
 */
export function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsKey = JSON.stringify(defaults);

  const filters = useMemo(() => {
    const base = JSON.parse(defaultsKey);
    const values = {};
    for (const key of Object.keys(base)) {
      values[key] = searchParams.get(key) ?? base[key];
    }
    values.page = Math.max(1, Number(searchParams.get('page')) || 1);
    return values;
  }, [searchParams, defaultsKey]);

  const setFilters = useCallback(
    (changes, { resetPage = true } = {}) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === '' || value == null) next.delete(key);
            else next.set(key, String(value));
          }
          if (resetPage && !('page' in changes)) next.delete('page');
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  return [filters, setFilters];
}

/** Drops empty values so they aren't sent as query params. */
export function compactParams(params) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null));
}

export function useJobRoleOptions() {
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    jobRolesApi
      .list({ limit: 100, includeInactive: true })
      .then(({ data }) => setRoles(data.data.items || []))
      .catch(() => setRoles([]));
  }, []);
  return roles;
}

export function AdminPageHeader({ title, description, backTo = '/admin/analytics', backLabel = 'Analytics' }) {
  return (
    <div>
      {backTo && (
        <Link
          to={backTo}
          className="focus-ring mb-2 inline-flex items-center gap-1 rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-[var(--color-text-muted)]">{description}</p>}
    </div>
  );
}

export function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
      {children}
    </label>
  );
}

export const selectClass =
  'focus-ring w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]';

export function DateRangeFilter({ from, to, onChange }) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="filter-from">From</FieldLabel>
        <input id="filter-from" type="date" className={selectClass} value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="filter-to">To</FieldLabel>
        <input id="filter-to" type="date" className={selectClass} value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value })} />
      </div>
    </>
  );
}

export function JobRoleFilter({ value, onChange, roles }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor="filter-role">Interview type</FieldLabel>
      <select id="filter-role" className={selectClass} value={value} onChange={(e) => onChange({ jobRole: e.target.value })}>
        <option value="">All job roles</option>
        {roles.map((role) => (
          <option key={role._id || role.id} value={role._id || role.id}>
            {role.roleName}
            {role.isActive === false ? ' (inactive)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Loading, error (with retry) and empty states shared by the admin lists. */
export function LoadState({ isLoading, error, isEmpty, emptyMessage, onRetry, children }) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="status">
        <Spinner size={28} className="text-brand-500" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (isEmpty) {
    return <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">{emptyMessage}</p>;
  }
  return children;
}

export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}
