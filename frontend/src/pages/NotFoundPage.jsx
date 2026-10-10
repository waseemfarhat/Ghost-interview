import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Aurora } from '../components/ui/Aurora';

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden bg-[var(--color-surface-alt)] px-4 text-center">
      <Aurora variant="hero" />
      <div className="relative">
        <p className="gi-gradient-text text-7xl font-extrabold tracking-tight sm:text-8xl">404</p>
      </div>
      <h1 className="relative text-2xl font-bold text-[var(--color-text)]">Page not found</h1>
      <p className="relative max-w-sm text-sm text-[var(--color-text-muted)]">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link to="/" className="relative mt-2">
        <Button>Go back home</Button>
      </Link>
    </div>
  );
}
