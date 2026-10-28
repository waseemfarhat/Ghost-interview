import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import {
  AdminPageHeader,
  DateRangeFilter,
  JobRoleFilter,
  LoadState,
  compactParams,
  formatDateTime,
  useJobRoleOptions,
  useUrlFilters
} from './adminShared';

const STATUS_TABS = [
  { value: 'all', label: 'All interviews' },
  { value: 'completed', label: 'Completed' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'terminated', label: 'Ended early' },
  { value: 'reported', label: 'With report' }
];

const DESCRIPTIONS = {
  all: 'Every interview session on the platform.',
  completed: 'Sessions where the candidate answered every question and a full report was generated.',
  incomplete: 'Sessions that have not been completed: still in progress, ended early, or interrupted.',
  in_progress: 'Sessions that are currently active or being processed.',
  terminated: 'Sessions the candidate ended before the final question.',
  reported: 'Sessions that produced a full or partial performance report.'
};

const PAGE_SIZE = 15;

export default function AdminInterviewsPage() {
  const [filters, setFilters] = useUrlFilters({ status: 'all', search: '', jobRole: '', user: '', from: '', to: '' });
  const roles = useJobRoleOptions();
  const [result, setResult] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => setSearchDraft(filters.search), [filters.search]);

  const { status, search, jobRole, user, from, to, page } = filters;
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.listSessions(
        compactParams({ status, search, jobRole, user, from, to, page, limit: PAGE_SIZE })
      );
      setResult(data.data);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [status, search, jobRole, user, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  const activeTab = STATUS_TABS.find((tab) => tab.value === status) || STATUS_TABS[0];
  const filteredUser = user && result.items.find((item) => item.user?.id === user)?.user;
  const hasFilters = search || jobRole || user || from || to;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={activeTab.label} description={DESCRIPTIONS[activeTab.value]} />

      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Interview status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === activeTab.value}
            onClick={() => setFilters({ status: tab.value === 'all' ? '' : tab.value })}
            className={`focus-ring shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
              tab.value === activeTab.value
                ? 'bg-brand-500 text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto_auto_auto] lg:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setFilters({ search: searchDraft.trim() });
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Search</span>
            <Input
              type="search"
              aria-label="Search by candidate name, email or job role"
              placeholder="Candidate name, email or job role"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </div>
          <JobRoleFilter value={jobRole} roles={roles} onChange={setFilters} />
          <DateRangeFilter from={from} to={to} onChange={setFilters} />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            {user && <span>Showing interviews for {filteredUser ? filteredUser.fullName : 'the selected user'}.</span>}
            <button
              type="button"
              className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-300"
              onClick={() => setFilters({ search: '', jobRole: '', user: '', from: '', to: '' })}
            >
              Clear filters
            </button>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <p className="mb-3 text-sm text-[var(--color-text-muted)]" aria-live="polite">
          {!isLoading && !error && `${result.pagination.total} interview${result.pagination.total === 1 ? '' : 's'}`}
        </p>
        <LoadState
          isLoading={isLoading}
          error={error}
          onRetry={load}
          isEmpty={!result.items.length}
          emptyMessage={hasFilters ? 'No interviews match these filters.' : 'No interviews in this category yet.'}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Candidate</th>
                  <th className="pb-2 pr-4 font-medium">Interview type</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Started</th>
                  <th className="pb-2 pr-4 font-medium">{status === 'completed' ? 'Completed' : 'Ended'}</th>
                  <th className="pb-2 pr-4 font-medium">Progress</th>
                  <th className="pb-2 font-medium">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((session) => (
                  <tr key={session.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-alt)]">
                    <td className="py-3 pr-4">
                      {session.user ? (
                        <button
                          type="button"
                          onClick={() => setFilters({ user: session.user.id })}
                          className="focus-ring rounded text-left"
                          title="Show this candidate's interviews"
                        >
                          <span className="block font-medium text-[var(--color-text)] hover:underline">{session.user.fullName}</span>
                          <span className="block text-xs text-[var(--color-text-muted)]">{session.user.email}</span>
                        </button>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">Unknown user</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text)]">{session.jobRole?.roleName || '-'}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{formatDateTime(session.startTime || session.createdAt)}</td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{formatDateTime(session.endTime)}</td>
                    <td className="py-3 pr-4 tabular-nums text-[var(--color-text-muted)]">
                      {session.answeredQuestions}/{session.totalQuestions}
                    </td>
                    <td className="py-3">
                      {session.report ? (
                        <Link
                          to={`/reports/${session.id}`}
                          className="focus-ring rounded font-semibold text-brand-600 hover:underline dark:text-brand-300"
                        >
                          {session.report.overallReadinessScore}/10{session.report.isPartial ? ' (partial)' : ''}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={result.pagination.page}
            totalPages={result.pagination.totalPages}
            onPageChange={(nextPage) => setFilters({ page: nextPage }, { resetPage: false })}
          />
        </LoadState>
      </Card>
    </div>
  );
}
