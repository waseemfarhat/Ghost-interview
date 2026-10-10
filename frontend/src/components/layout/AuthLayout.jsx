import { Link, Outlet } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Aurora } from '../ui/Aurora';

const HIGHLIGHTS = [
  'Realistic AI avatar that speaks each question',
  'Live speech-to-text and filler-word analysis',
  'On-device emotion & confidence detection',
  'Downloadable confidence & competency report'
];

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--color-surface-alt)] lg:flex-row">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <Aurora variant="corner" />
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm ring-1 ring-white/25 backdrop-blur">
              GI
            </span>
            <span className="text-lg">Ghost Interview</span>
          </Link>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-white">
            Practice like it&apos;s the real thing.
          </h2>
          <p className="mt-4 text-brand-100">
            Join Ghost Interview and get instant, actionable feedback on every answer — so the next time you sit
            down for a real interview, nothing surprises you.
          </p>
          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="flex items-center gap-3 text-sm text-brand-50">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                  <svg className="h-3.5 w-3.5 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-brand-200">Built for COMSATS Vehari FYP</p>
      </aside>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col">
        <header className="flex items-center justify-between px-6 py-4 sm:px-10">
          <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight text-[var(--color-text)] lg:invisible">
            <span className="gi-glow flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm text-white">
              GI
            </span>
            <span className="text-lg">Ghost Interview</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="gi-fade-up w-full max-w-md">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

