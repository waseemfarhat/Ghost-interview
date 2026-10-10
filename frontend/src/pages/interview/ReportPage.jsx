import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { reportsApi } from '../../api/reports.api';
import { extractErrorMessage } from '../../api/client';
import { buildReportPdf } from '../../utils/exportReportPdf';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ScoreBar } from '../../components/ui/ScoreBar';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { EmotionDonut } from '../../components/ui/EmotionDonut';
import { Aurora } from '../../components/ui/Aurora';
import { FullPageSpinner } from '../../components/ui/Spinner';

export default function ReportPage() {
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = () => {
    if (!report) return;
    setIsExporting(true);
    try {
      const fileName = buildReportPdf(report);
      toast.success(`Report downloaded as ${fileName}`);
    } catch {
      toast.error('Could not generate the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await reportsApi.getBySession(sessionId);
        if (!cancelled) setReport(data.data.report);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (isLoading) return <FullPageSpinner />;

  if (!report) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]">
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6M9 15h6" />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Report not found</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">This report may have been removed or the link is incorrect.</p>
        <Link to="/dashboard" className="mt-5 inline-block">
          <Button>Back to dashboard</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">
            {report.session?.jobRole?.roleName || 'Interview'} Report
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Generated {new Date(report.generatedAt).toLocaleString()}
            {report.isPartial && ' · Partial report (interview ended early)'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExportPdf} isLoading={isExporting}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download PDF
          </Button>
          <Link to="/interview/new">
            <Button variant="secondary">Practice again</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="relative overflow-hidden p-6 sm:col-span-1">
          <Aurora variant="corner" />
          <div className="relative flex flex-col items-center gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Overall Readiness</p>
            <ProgressRing value={report.overallReadinessScore} max={10} size={150} decimals={1} gradientId="readiness-ring" />
          </div>
        </Card>
        <Card className="p-6 sm:col-span-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Performance breakdown</h2>
          <div className="mt-4 flex flex-col gap-4">
            <ScoreBar label="Confidence" value={report.confidenceScore} color="#6d4bff" />
            <ScoreBar label="Competency" value={report.competencyScore} color="#14c8bd" />
            <ScoreBar label="Communication" value={report.communicationScore} color="#8b74ff" />
            <ScoreBar label="Emotional stability" value={report.emotionalStabilityScore} color="#38bdf8" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Facial emotion breakdown</h2>
        </div>
        <div className="mt-4">
          <EmotionDonut distribution={report.emotionSummary?.distribution} />
        </div>
        {report.emotionSummary?.timeline?.length > 0 && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Emotion timeline</h3>
            <ol className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {report.emotionSummary.timeline.map((reading, index) => (
                <li
                  key={`${reading.capturedAt}-${index}`}
                  className="min-w-28 border-l-2 border-brand-400 pl-3"
                >
                  <p className="text-xs capitalize text-[var(--color-text-muted)]">{reading.emotionLabel}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-text)]">
                    {new Date(reading.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {reading.nervousnessScore != null && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Nervousness {Math.round(reading.nervousnessScore * 100)}%
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Strengths</h2>
          </div>
          {report.strengths?.length ? (
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[var(--color-text)]">
              {report.strengths.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">No standout strengths identified yet.</p>
          )}
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </span>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Areas to improve</h2>
          </div>
          {report.improvementAreas?.length ? (
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-[var(--color-text)]">
              {report.improvementAreas.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">No specific improvement areas flagged.</p>
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Filler words</p>
            <p className="mt-0.5 text-lg font-bold text-[var(--color-text)]">{report.fillerWordCount}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Overall tone</p>
            <p className="mt-0.5 text-lg font-bold capitalize text-[var(--color-text)]">{report.sentimentSummary}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
