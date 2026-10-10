import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { jobRolesApi } from '../../api/jobRoles.api';
import { sessionsApi } from '../../api/sessions.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

export default function JobRoleSelectionPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await jobRolesApi.list({ limit: 50 });
        if (!cancelled) setRoles(data.data.items);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async () => {
    if (!selectedRoleId) {
      toast.error('Select a job role first');
      return;
    }
    setIsStarting(true);
    try {
      const { data } = await sessionsApi.start(selectedRoleId);
      navigate(`/interview/${data.data.session.id}`);
    } catch (error) {
      toast.error(extractErrorMessage(error));
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Step 1 of 1 — choose your role
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Start a mock interview
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">
          Choose a job role. The AI interviewer will ask role-specific questions and analyze your speech and facial
          expressions as you answer.
        </p>
      </div>

      {roles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
          No job roles are available yet. Please check back later or contact an administrator.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const isSelected = selectedRoleId === role._id;
            return (
              <button
                key={role._id}
                type="button"
                onClick={() => setSelectedRoleId(role._id)}
                aria-pressed={isSelected}
                className={`focus-ring group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/20 dark:bg-brand-900/30'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg'
                }`}
              >
                {isSelected && (
                  <span className="gi-glow absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                )}
                <span className="inline-block rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                  {role.category}
                </span>
                <h2 className="mt-2.5 text-base font-semibold text-[var(--color-text)]">{role.roleName}</h2>
                {role.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-[var(--color-text-muted)]">{role.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-4 flex items-center gap-3">
        <Button onClick={handleStart} isLoading={isStarting} disabled={!selectedRoleId} size="lg">
          Start interview
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Button>
        {!selectedRoleId && (
          <span className="text-sm text-[var(--color-text-muted)]">Select a role to continue</span>
        )}
      </div>
    </div>
  );
}
