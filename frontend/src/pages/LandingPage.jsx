import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Button } from '../components/ui/Button';
import { Aurora } from '../components/ui/Aurora';
import { Reveal } from '../components/ui/Reveal';
import { FullPageSpinner } from '../components/ui/Spinner';

const FEATURES = [
  {
    title: 'AI voice interviewer',
    body: 'A lifelike AI avatar asks role-specific questions out loud and listens to your answers in real time.',
    icon: <path d="M12 1a3 3 0 013 3v8a3 3 0 11-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
  },
  {
    title: 'Speech & filler analysis',
    body: 'Every answer is transcribed and scored for filler words and sentiment so you can speak with clarity.',
    icon: <path d="M4 7h16M4 12h10M4 17h7M18 14l3 3-3 3" />
  },
  {
    title: 'Facial expression insight',
    body: 'On-device emotion detection reads confidence and composure — your webcam video never leaves your browser.',
    icon: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
  },
  {
    title: 'Confidence & competency report',
    body: 'Get a detailed, downloadable scorecard with strengths, improvement areas, and an overall readiness rating.',
    icon: <path d="M3 3v18h18M7 15l3-4 3 3 4-6" />
  },
  {
    title: 'Track your progress',
    body: 'Review past interviews and watch your readiness climb over time from your personal dashboard.',
    icon: <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" />
  },
  {
    title: 'Practice anywhere',
    body: 'Runs entirely in your browser with a curated question bank across many popular job roles.',
    icon: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
  }
];

const STEPS = [
  { n: '01', title: 'Pick a job role', body: 'Choose from roles like Software Engineer, Data Analyst, HR, and more.' },
  { n: '02', title: 'Answer by voice', body: 'The AI speaks each question; you respond naturally with your microphone.' },
  { n: '03', title: 'Get your scorecard', body: 'Receive an instant confidence & competency report you can download as a PDF.' }
];

function FeatureIcon({ children }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/15 to-accent-500/15 text-brand-600 ring-1 ring-brand-500/20 dark:text-brand-300">
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export default function LandingPage() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--color-surface-alt)]">
      <Aurora variant="hero" />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-[var(--color-text)]">
          <span className="gi-glow flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm text-white">
            GI
          </span>
          <span className="text-lg">Ghost Interview</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/register">
            <Button>Sign up</Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:pt-20">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--color-text-muted)] shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-500" />
              </span>
              AI-powered mock interviews, in your browser
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-[var(--color-text)] sm:text-6xl">
              Walk into your next interview <span className="gi-gradient-text">already prepared.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-text-muted)] sm:text-lg">
              Ghost Interview simulates a real job interview with an AI avatar — it asks questions by voice, analyzes
              your speech and confidence, and delivers a detailed performance report so you can improve before it counts.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Get started for free
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  I already have an account
                </Button>
              </Link>
            </div>
          </Reveal>
        </section>


        {/* Feature grid */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <Reveal>
            <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
              Everything you need to practice
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-[var(--color-text-muted)]">
              A complete mock-interview loop — from the first question to an actionable scorecard.
            </p>
          </Reveal>

          <div className="gi-stagger mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="gi-lift rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <FeatureIcon>{f.icon}</FeatureIcon>
                <h3 className="mt-4 text-base font-semibold text-[var(--color-text)]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12">
              <Aurora variant="corner" />
              <div className="relative">
                <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">How it works</h2>
                <div className="gi-stagger mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3">
                  {STEPS.map((s) => (
                    <div key={s.n}>
                      <span className="gi-gradient-text text-3xl font-extrabold">{s.n}</span>
                      <h3 className="mt-2 text-base font-semibold text-[var(--color-text)]">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{s.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)] sm:text-3xl">
              Ready to ace your interview?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[var(--color-text-muted)]">
              Create a free account and run your first AI mock interview in minutes.
            </p>
            <div className="mt-7">
              <Link to="/register">
                <Button size="lg">Start practicing now</Button>
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border)] px-6 py-6 text-center text-sm text-[var(--color-text-muted)] sm:px-10">
        Ghost Interview — AI Mock Interviewer · Built for COMSATS Vehari FYP
      </footer>
    </div>
  );
}

