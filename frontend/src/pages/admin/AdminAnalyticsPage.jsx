import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';
import { useCountUp } from '../../hooks/useCountUp';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { Aurora } from '../../components/ui/Aurora';
import { Input } from '../../components/ui/Input';

function StatCard({ label, value, icon, to, hint }) {
  const { ref, display } = useCountUp(value);
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. ${hint}`}
      className="focus-ring gi-lift group relative block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
          <p ref={ref} className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
            {display}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-600 dark:text-brand-300">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-brand-600 group-hover:underline dark:text-brand-300">{hint}</p>
    </Link>
  );
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [roleSearch, setRoleSearch] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminApi.getAnalyticsOverview();
      setStats(data.data);
    } catch (error) {
      setLoadError(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading && !stats) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Spinner size={32} className="text-brand-500" />
      </div>
    );
  }

  if (loadError && !stats) {
    return (
      <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  if (!stats) return null;

  const roleInterviewCounts = (stats.jobRoleInterviewCounts || [])
    .filter((role) =>
      `${role.roleName} ${role.category}`.toLocaleLowerCase().includes(roleSearch.trim().toLocaleLowerCase())
    )
    .sort((first, second) => second.completedInterviewCount - first.completedInterviewCount);

  return (
    <div className="flex flex-col gap-6">
      <div className="gi-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Platform-wide usage and performance overview. Select any card to see the records behind it.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} isLoading={isLoading}>
          Refresh
        </Button>
      </div>

      <div className="gi-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard to="/admin/users" hint="View registered users" label="Total users" value={stats.totalUsers} icon={<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87" />} />
        <StatCard to="/admin/users?role=candidate" hint="View candidates" label="Candidates" value={stats.totalCandidates} icon={<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />} />
        <StatCard to="/admin/interviews" hint="View all interviews" label="Total interviews" value={stats.totalSessions} icon={<path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4" />} />
        <StatCard to="/admin/interviews?status=completed" hint="View completed interviews" label="Completed interviews" value={stats.completedSessions} icon={<path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />} />
        <StatCard to="/admin/interviews?status=incomplete" hint="View incomplete interviews" label="Incomplete interviews" value={stats.incompleteSessions} icon={<path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4M12 16h.01" />} />
        <StatCard to="/admin/interviews?status=in_progress" hint="View sessions in progress" label="In progress now" value={stats.activeSessions} icon={<path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2" />} />
        <StatCard to="/admin/interviews?status=reported" hint="View reported interviews" label="Reports generated" value={stats.totalReports} icon={<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8" />} />
        <StatCard to="/admin/job-roles" hint="Manage job roles" label="Active job roles" value={stats.totalJobRoles} icon={<path d="M20 7h-4V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link to="/admin/analytics/performance" className="focus-ring gi-lift block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm font-semibold text-[var(--color-text)]">Interview performance</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Completion rate {stats.completionRate}%. Scores, trends and filters by date range and interview type.
          </p>
          <p className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-300">Open performance analytics</p>
        </Link>
        <Link to="/admin/activity" className="focus-ring gi-lift block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-sm font-semibold text-[var(--color-text)]">User activity</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Recent registrations, interviews started, completed and ended early.</p>
          <p className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-300">Open activity feed</p>
        </Link>
      </div>

      <Card className="relative overflow-hidden p-6">
        <Aurora variant="corner" />
        <div className="relative">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--color-text)]">Average scores across all reports</h2>
            <Link to="/admin/analytics/performance" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
              View performance details
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { label: 'Avg. confidence', value: stats.averageScores.confidence, suffix: '' },
              { label: 'Avg. competency', value: stats.averageScores.competency, suffix: '' },
              { label: 'Avg. readiness', value: stats.averageScores.readiness, suffix: '/10' }
            ].map((m) => (
              <ScoreStat key={m.label} label={m.label} value={m.value} suffix={m.suffix} />
            ))}
          </div>
        </div>
      </Card>

      <Card className="gi-fade-up p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Completed interviews by job role</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              See how many interviews candidates have completed for each role.
            </p>
          </div>
          <Input
            type="search"
            aria-label="Search role interview counts"
            placeholder="Search roles"
            value={roleSearch}
            onChange={(event) => setRoleSearch(event.target.value)}
            className="w-full sm:max-w-xs"
          />
        </div>
        {roleInterviewCounts.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {roleSearch.trim() ? 'No job roles match your search.' : 'No job roles have been added yet.'}
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Job role</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Completed interviews</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {roleInterviewCounts.map((role) => (
                  <tr
                    key={role.id}
                    className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-alt)]"
                  >
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        to={`/admin/interviews?status=completed&jobRole=${role.id}`}
                        className="focus-ring rounded text-[var(--color-text)] hover:text-brand-600 hover:underline"
                      >
                        {role.roleName}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{role.category}</td>
                    <td className="py-3 pr-4 font-semibold tabular-nums">
                      <Link
                        to={`/admin/interviews?status=completed&jobRole=${role.id}`}
                        className="focus-ring rounded text-brand-600 hover:underline"
                        aria-label={`${role.completedInterviewCount} completed ${role.roleName} interviews`}
                      >
                        {role.completedInterviewCount}
                      </Link>
                    </td>
                    <td className="py-3 text-[var(--color-text-muted)]">{role.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreStat({ label, value, suffix }) {
  const { ref, display } = useCountUp(value, { decimals: suffix ? 1 : 0 });
  return (
    <div ref={ref} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center">
      <p className="text-4xl font-extrabold text-brand-600">
        {display}
        <span className="text-lg font-semibold text-[var(--color-text-muted)]">{suffix}</span>
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}
