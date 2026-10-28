import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { sessionsApi } from '../../api/sessions.api';
import { reportsApi } from '../../api/reports.api';
import { extractErrorMessage } from '../../api/client';
import { useCountUp } from '../../hooks/useCountUp';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { StatusBadge } from '../../components/ui/Badge';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { Aurora } from '../../components/ui/Aurora';

function StatCard({ label, value, icon, accent }) {
  const { ref, display } = useCountUp(value);
  return (
    <Card hover className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
          {value == null ? (
            <p className="mt-1 truncate text-base font-bold text-[var(--color-text)]">{display || ''}</p>
          ) : (
            <p ref={ref} className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
              {display}
            </p>
          )}
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            accent
              ? 'bg-gradient-to-br from-accent-500/15 to-accent-500/5 text-accent-600 dark:text-accent-400'
              : 'bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300'
          }`}
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </span>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0];

  const [sessions, setSessions] = useState([]);
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = async (page = 1) => {
    setIsLoading(true);
    try {
      const { data } = await sessionsApi.list({ page, limit: 5 });
      setSessions(data.data.items);
      setPagination(data.data.pagination);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const [completedCount, setCompletedCount] = useState(null);

  useEffect(() => {
    loadSessions(1);
    reportsApi.list({ page: 1, limit: 8 })
      .then(({ data }) => setReports(data.data.items))
      .catch((error) => toast.error(extractErrorMessage(error)));
    sessionsApi.list({ page: 1, limit: 1, status: 'completed' })
      .then(({ data }) => setCompletedCount(data.data.pagination.total))
      .catch(() => setCompletedCount(0));
  }, []);

  const chronologicalReports = reports.slice().reverse();
  const recentReadiness = chronologicalReports.map((report) => report.overallReadinessScore);
  const latestReadiness = recentReadiness.length ? recentReadiness[recentReadiness.length - 1] : null;
  const avgReadiness = recentReadiness.length
    ? (recentReadiness.reduce((a, b) => a + b, 0) / recentReadiness.length).toFixed(1)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <Aurora variant="corner" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome to your AI Interview Dashboard'}
            </h1>
            <p className="mt-1.5 max-w-2xl text-[var(--color-text-muted)]">
              Prepare for your next interview with personalized questions, realistic interview simulations, and
              performance insights.
            </p>
          </div>
          <Link to="/interview/new">
            <Button>
              Start new interview
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Button>
          </Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total sessions" value={pagination.total} icon={<path d="M3 3v18h18M7 15l3-4 3 3 4-6" />} />
        <StatCard label="Completed interviews" value={completedCount ?? 0} icon={<path d="M20 6L9 17l-5-5" />} accent />
        <Card hover className="relative overflow-hidden p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Account</p>
              <p className="mt-1 truncate text-base font-bold text-[var(--color-text)]">{user?.email}</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-brand-500/5 text-brand-600 dark:text-brand-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </span>
          </div>
        </Card>
      </div>

      {reports.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)]">Readiness over recent interviews</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Scores from your latest reports, oldest to newest.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-brand-600">{latestReadiness}/10</p>
              <p className="text-xs text-[var(--color-text-muted)]">latest · avg {avgReadiness}</p>
            </div>
          </div>
          <div className="mt-6 flex h-32 items-end gap-2 border-b border-[var(--color-border)] pb-1">
            {chronologicalReports.map((report, index) => (
              <div key={report._id} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className="min-h-1 rounded-t-lg bg-gradient-to-t from-brand-600 to-accent-500 transition-all duration-500 group-hover:opacity-80"
                  style={{ height: `${Math.max(4, (report.overallReadinessScore / 10) * 100)}%` }}
                  title={`${report.overallReadinessScore}/10`}
                  aria-label={`Interview ${index + 1}: readiness ${report.overallReadinessScore} out of 10`}
                />
                <span className="mt-1.5 text-center text-[10px] text-[var(--color-text-muted)]">{index + 1}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Interview history</h2>

        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-3">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-500">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2" />
              </svg>
            </span>
            <p className="mt-4 text-sm text-[var(--color-text-muted)]">You haven&apos;t taken any mock interviews yet.</p>
            <Link to="/interview/new" className="mt-4">
              <Button size="sm">Start your first interview</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Job role</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 font-medium">Report</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-alt)]">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text)]">{s.jobRole?.roleName || '—'}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {s.status === 'completed' || s.status === 'terminated' ? (
                        <Link to={`/reports/${s.id}`} className="font-semibold text-brand-600 hover:underline dark:text-brand-300">
                          View report
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={loadSessions} />
          </div>
        )}
      </Card>
    </div>
  );
}
