import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Pagination } from '../../components/ui/Pagination';
import { AdminPageHeader, LoadState, formatDateTime, useUrlFilters } from './adminShared';

const TYPE_TABS = [
  { value: 'all', label: 'All activity' },
  { value: 'registered', label: 'Registrations' },
  { value: 'started', label: 'Interviews started' },
  { value: 'completed', label: 'Interviews completed' },
  { value: 'terminated', label: 'Ended early' }
];

const EVENT_TEXT = {
  registered: 'created an account',
  started: 'started an interview',
  completed: 'completed an interview',
  terminated: 'ended an interview early'
};

const EVENT_DOT = {
  registered: 'bg-slate-400',
  started: 'bg-brand-500',
  completed: 'bg-emerald-500',
  terminated: 'bg-amber-500'
};

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AdminActivityPage() {
  const [filters, setFilters] = useUrlFilters({ type: 'all' });
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { type, page } = filters;
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.getActivity({ type, page, limit: 20 });
      setResult(data.data);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [type, page]);

  useEffect(() => {
    load();
  }, [load]);

  const weekFrom = isoDaysAgo(6);
  const summary = result?.lastSevenDays;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="User activity" description="Recorded registrations and interview events, newest first." />

      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'New users (7 days)', value: summary.newUsers, to: `/admin/users?from=${weekFrom}` },
            { label: 'Interviews started (7 days)', value: summary.startedSessions, to: `/admin/interviews?from=${weekFrom}` },
            { label: 'Interviews completed (7 days)', value: summary.completedSessions, to: `/admin/interviews?status=completed&from=${weekFrom}` }
          ].map((tile) => (
            <Link key={tile.label} to={tile.to} className="focus-ring gi-lift block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{tile.label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[var(--color-text)]">{tile.value}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Activity type">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === type}
            onClick={() => setFilters({ type: tab.value === 'all' ? '' : tab.value })}
            className={`focus-ring shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab.value === type ? 'bg-brand-500 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-6">
        <LoadState isLoading={isLoading} error={error} onRetry={load} isEmpty={!result?.items.length} emptyMessage="No activity recorded yet.">
          <ol className="flex flex-col">
            {result?.items.map((event, index) => (
              <li key={`${event.type}-${event.sessionId || event.user?.id}-${index}`} className="flex gap-3 border-b border-[var(--color-border)] py-3 last:border-0">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${EVENT_DOT[event.type]}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--color-text)]">
                    {event.user ? (
                      <Link to={`/admin/interviews?user=${event.user.id}`} className="focus-ring rounded font-semibold hover:underline">
                        {event.user.fullName}
                      </Link>
                    ) : (
                      <span className="font-semibold">A removed user</span>
                    )}{' '}
                    {EVENT_TEXT[event.type]}
                    {event.jobRole && (
                      <>
                        {' for '}
                        <Link to={`/admin/interviews?jobRole=${event.jobRole.id}`} className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-300">
                          {event.jobRole.roleName}
                        </Link>
                      </>
                    )}
                    {event.type === 'completed' && event.sessionId && (
                      <>
                        {' - '}
                        <Link to={`/reports/${event.sessionId}`} className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-300">
                          view report
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatDateTime(event.at)}</p>
                </div>
              </li>
            ))}
          </ol>
          {result && (
            <Pagination
              page={result.pagination.page}
              totalPages={result.pagination.totalPages}
              onPageChange={(nextPage) => setFilters({ page: nextPage }, { resetPage: false })}
            />
          )}
        </LoadState>
      </Card>
    </div>
  );
}
