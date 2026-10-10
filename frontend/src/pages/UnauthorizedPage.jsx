import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Aurora } from '../components/ui/Aurora';

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[var(--color-surface-alt)] px-4 text-center">
      <Aurora variant="hero" />
      <div className="relative">
        <p className="gi-gradient-text text-7xl font-extrabold tracking-tight sm:text-8xl">403</p>
      </div>
      <h1 className="relative text-2xl font-bold text-[var(--color-text)]">Access denied</h1>
      <p className="relative max-w-sm text-sm text-[var(--color-text-muted)]">
        You don&apos;t have permission to view this page.
      </p>
      <Link to="/dashboard" className="relative mt-2">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
