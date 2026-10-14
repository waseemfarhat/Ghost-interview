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
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await jobRolesApi.list({ limit: 100 });
        if (!cancelled) {
          setRoles(data.data.items);
          setSuggestions(data.data.items);
        }
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

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      const normalizedTerm = term.toLocaleLowerCase();
      setSuggestions(
        term
          ? roles.filter((role) =>
              `${role.roleName} ${role.category}`.toLocaleLowerCase().includes(normalizedTerm)
            )
          : roles
      );
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    setSuggestions([]);
    setIsSearching(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const { data } = await jobRolesApi.list({ search: term, limit: 8 });
        if (!cancelled) setSuggestions(data.data.items);
      } catch (error) {
        if (!cancelled) toast.error(extractErrorMessage(error));
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, roles]);

  const selectRole = (role) => {
    setSelectedRole(role);
    setQuery(role.roleName);
    setIsSearchOpen(false);
  };

  const handleGenerateRole = async () => {
    const roleName = query.trim();
    if (roleName.length < 2) return;

    setIsGenerating(true);
    try {
      const { data } = await jobRolesApi.generate(roleName);
      const { jobRole, created, notifiedAdmins } = data.data;
      setRoles((items) => [jobRole, ...items.filter((role) => role._id !== jobRole._id)]);
      setSelectedRole(jobRole);
      setQuery(jobRole.roleName);
      setIsSearchOpen(false);
      if (created) {
        toast.success('AI created this role and generated its interview questions.');
        if (!notifiedAdmins) toast.error('The role is active, but no administrator could be notified.');
      } else {
        toast.success('This role already exists. It is ready to select.');
      }
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStart = async () => {
    if (!selectedRole) {
      toast.error('Select a job role first');
      return;
    }
    setIsStarting(true);
    try {
      const { data } = await sessionsApi.start(selectedRole._id);
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

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const hasExactMatch = suggestions.some((role) => role.roleName.toLocaleLowerCase() === normalizedQuery);

  return (
    <div className="flex flex-col gap-6">
      <div className="gi-fade-up">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          Step 1 of 1 — choose your role
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">
          Start a mock interview
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--color-text-muted)]">
          Search for a role or type a new one. If it is not listed, AI can create the role and prepare tailored interview questions for you.
        </p>
      </div>

      <div className="relative z-20 max-w-2xl gi-fade-up">
        <label htmlFor="job-role-search" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
          Search job roles
        </label>
        <div className="relative">
          <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            id="job-role-search"
            type="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="job-role-suggestions"
            aria-expanded={isSearchOpen && query.trim().length > 0}
            maxLength={100}
            placeholder="Try Accountant, Product Designer, or Data Analyst"
            value={query}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedRole(null);
              setIsSearchOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsSearchOpen(false);
            }}
            onBlur={() => setIsSearchOpen(false)}
            className="focus-ring w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-3.5 pl-12 pr-12 text-sm text-[var(--color-text)] shadow-sm transition-all placeholder:text-[var(--color-text-muted)] hover:border-brand-300 focus:border-brand-400 focus:shadow-lg focus:shadow-brand-500/10"
          />
          {isSearching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              <Spinner size={18} className="text-brand-500" />
            </span>
          )}
        </div>

        {isSearchOpen && query.trim().length > 0 && (
          <div
            id="job-role-suggestions"
            role="listbox"
            className="gi-scale-in absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xl"
          >
            {suggestions.map((role) => (
              <button
                key={role._id}
                type="button"
                role="option"
                aria-selected={selectedRole?._id === role._id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectRole(role)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-brand-500/10 hover:pl-4"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--color-text)]">{role.roleName}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{role.category}</span>
                </span>
                <svg className="h-4 w-4 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ))}
            {!isSearching && suggestions.length === 0 && query.trim().length >= 2 && (
              <div className="p-3">
                <p className="text-sm text-[var(--color-text-muted)]">No matching role found.</p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  isLoading={isGenerating}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleGenerateRole}
                >
                  Generate “{query.trim()}” with AI
                </Button>
              </div>
            )}
            {suggestions.length > 0 && !hasExactMatch && query.trim().length >= 2 && (
              <div className="mt-1 border-t border-[var(--color-border)] p-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  isLoading={isGenerating}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleGenerateRole}
                >
                  Generate “{query.trim()}” with AI
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedRole && (
        <Card className="gi-fade-up flex max-w-2xl items-center justify-between gap-4 border-brand-300 bg-brand-500/5 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">Selected role</p>
            <h2 className="mt-1 text-lg font-bold text-[var(--color-text)]">{selectedRole.roleName}</h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{selectedRole.category}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        </Card>
      )}

      {!query.trim() && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Popular roles</h2>
          {roles.length === 0 ? (
            <Card className="p-8 text-center text-sm text-[var(--color-text-muted)]">
              No job roles are available yet. Search for a role above to create one with AI.
            </Card>
          ) : (
            <div className="gi-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => {
                const isSelected = selectedRole?._id === role._id;
                return (
                  <button
                    key={role._id}
                    type="button"
                    onClick={() => selectRole(role)}
                    aria-pressed={isSelected}
                    className={`gi-lift gi-gradient-border focus-ring group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/20 dark:bg-brand-900/30'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
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
        </div>
      )}

      <div className="sticky bottom-4 flex items-center gap-3">
        <Button onClick={handleStart} isLoading={isStarting} disabled={!selectedRole} size="lg">
          Start interview
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Button>
        {!selectedRole && <span className="text-sm text-[var(--color-text-muted)]">Select a role to continue</span>}
      </div>
    </div>
  );
}
