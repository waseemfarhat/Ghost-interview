import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  AdminPageHeader,
  DateRangeFilter,
  JobRoleFilter,
  LoadState,
  compactParams,
  useJobRoleOptions,
  useUrlFilters
} from './adminShared';

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: null }
];

// "2026-10" -> first/last day of that month, for month-granularity drill-downs.
function periodRange(period, granularity) {
  if (granularity === 'day') return { from: period, to: period };
  const [year, month] = period.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return { from: `${period}-01`, to: toIsoDate(last) };
}

function formatPeriod(period, granularity) {
  const date = new Date(granularity === 'day' ? `${period}T00:00:00Z` : `${period}-01T00:00:00Z`);
  return date.toLocaleDateString(undefined, granularity === 'day' ? { month: 'short', day: 'numeric', timeZone: 'UTC' } : { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function AdminPerformancePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useUrlFilters({ jobRole: '', from: '', to: '' });
  const roles = useJobRoleOptions();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { jobRole, from, to } = filters;
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: response } = await adminApi.getPerformance(compactParams({ jobRole, from, to }));
      setData(response.data);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [jobRole, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (days) => {
    if (!days) {
      setFilters({ from: '', to: '' });
      return;
    }
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    setFilters({ from: toIsoDate(start), to: toIsoDate(end) });
  };

  // Drill-down links carry the current filters to the interview list.
  const interviewsLink = (extra) => {
    const params = new URLSearchParams(compactParams({ jobRole, from, to, ...extra }));
    return `/admin/interviews?${params.toString()}`;
  };

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Interview performance"
        description="Scores, completion rates and trends from recorded interviews. Select any figure to see the interviews behind it."
      />

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <JobRoleFilter value={jobRole} roles={roles} onChange={setFilters} />
          <DateRangeFilter from={from} to={to} onChange={setFilters} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset.label} size="sm" variant="ghost" onClick={() => applyPreset(preset.days)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </Card>

      <LoadState
        isLoading={isLoading}
        error={error}
        onRetry={load}
        isEmpty={!totals?.sessions}
        emptyMessage="No interviews were recorded for these filters."
      >
        {totals && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricTile to={interviewsLink({})} label="Interviews" value={totals.sessions} />
              <MetricTile to={interviewsLink({ status: 'completed' })} label="Completed" value={totals.completed} />
              <MetricTile
                to={interviewsLink({ status: 'completed' })}
                label="Completion rate"
                value={`${totals.completionRate}%`}
              />
              <MetricTile to={interviewsLink({ status: 'incomplete' })} label="Incomplete" value={totals.sessions - totals.completed} />
            </div>

            <Card className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Average scores</h2>
                <Link to={interviewsLink({ status: 'reported' })} className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">
                  View {totals.reports} reported interview{totals.reports === 1 ? '' : 's'}
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: 'Readiness', value: totals.avgReadiness, suffix: '/10' },
                  { label: 'Confidence', value: totals.avgConfidence, suffix: '%' },
                  { label: 'Competency', value: totals.avgCompetency, suffix: '%' },
                  { label: 'Communication', value: totals.avgCommunication, suffix: '%' },
                  { label: 'Emotional stability', value: totals.avgEmotionalStability, suffix: '%' }
                ].map((score) => (
                  <div key={score.label} className="rounded-xl border border-[var(--color-border)] p-4">
                    <dd className="text-2xl font-extrabold tabular-nums text-[var(--color-text)]">
                      {score.value == null ? '-' : score.value}
                      {score.value != null && <span className="text-sm font-semibold text-[var(--color-text-muted)]">{score.suffix}</span>}
                    </dd>
                    <dt className="mt-1 text-xs text-[var(--color-text-muted)]">{score.label}</dt>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="p-6">
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                Interviews per {data.trend.granularity === 'day' ? 'day' : 'month'}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Select a bar to list the interviews from that period.</p>
              <BarChart
                points={data.trend.points.map((point) => ({
                  key: point.period,
                  label: formatPeriod(point.period, data.trend.granularity),
                  value: point.sessions,
                  detail: `${point.sessions} interviews, ${point.completed} completed (${point.completionRate}%)${
                    point.avgReadiness != null ? `, avg readiness ${point.avgReadiness}/10` : ''
                  }`,
                  onSelect: () => navigate(interviewsLink(periodRange(point.period, data.trend.granularity)))
                }))}
              />
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="p-6">
                <h2 className="text-base font-semibold text-[var(--color-text)]">Readiness score distribution</h2>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Number of reports in each overall readiness band (out of 10).</p>
                <BarChart
                  points={data.readinessDistribution.map((bucket) => ({
                    key: bucket.range,
                    label: bucket.range,
                    value: bucket.count,
                    detail: `${bucket.count} report${bucket.count === 1 ? '' : 's'} scored ${bucket.range}`
                  }))}
                />
              </Card>

              <Card className="p-6">
                <h2 className="text-base font-semibold text-[var(--color-text)]">By interview type</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                        <th className="pb-2 pr-3 font-medium">Job role</th>
                        <th className="pb-2 pr-3 text-right font-medium">Interviews</th>
                        <th className="pb-2 pr-3 text-right font-medium">Completion</th>
                        <th className="pb-2 text-right font-medium">Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byRole.map((role) => (
                        <tr key={role.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-alt)]">
                          <td className="py-2.5 pr-3">
                            <Link
                              to={interviewsLink({ jobRole: role.id })}
                              className="focus-ring rounded font-medium text-[var(--color-text)] hover:text-brand-600 hover:underline"
                            >
                              {role.roleName}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{role.sessions}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{role.completionRate}%</td>
                          <td className="py-2.5 text-right tabular-nums text-[var(--color-text-muted)]">
                            {role.avgReadiness == null ? '-' : `${role.avgReadiness}/10`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </LoadState>
    </div>
  );
}

function MetricTile({ to, label, value }) {
  return (
    <Link
      to={to}
      className="focus-ring gi-lift block rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="mt-2 text-xs font-medium text-brand-600 dark:text-brand-300">View interviews</p>
    </Link>
  );
}

/** Single-series bar chart with per-bar hover tooltips and an optional click-through. */
function BarChart({ points }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...points.map((point) => point.value));
  const labelEvery = Math.ceil(points.length / 12);

  if (!points.length) {
    return <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No data for this period.</p>;
  }

  return (
    <div className="relative mt-6">
      <div className="flex h-44 items-end gap-0.5 border-b border-[var(--color-border)] sm:gap-1" role="list">
        {points.map((point, index) => {
          const Element = point.onSelect ? 'button' : 'div';
          return (
            <Element
              key={point.key}
              type={point.onSelect ? 'button' : undefined}
              role="listitem"
              aria-label={`${point.label}: ${point.detail}`}
              onClick={point.onSelect}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className={`focus-ring group flex h-full min-w-0 flex-1 flex-col justify-end rounded-t ${point.onSelect ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`block w-full rounded-t bg-brand-500 transition-opacity ${hovered != null && hovered !== index ? 'opacity-50' : ''}`}
                style={{ height: point.value ? `${Math.max(2, (point.value / max) * 100)}%` : '0%' }}
              />
            </Element>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-0.5 sm:gap-1" aria-hidden="true">
        {points.map((point, index) => (
          <span key={point.key} className="min-w-0 flex-1 truncate text-center text-[10px] text-[var(--color-text-muted)]">
            {index % labelEvery === 0 ? point.label : ''}
          </span>
        ))}
      </div>
      {hovered != null && (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-[var(--color-text)]">{points[hovered].label}</p>
          <p className="text-[var(--color-text-muted)]">{points[hovered].detail}</p>
        </div>
      )}
    </div>
  );
}
