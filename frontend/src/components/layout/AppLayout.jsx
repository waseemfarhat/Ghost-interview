import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';
import { AdminNotificationBell } from './AdminNotificationBell';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: DashboardIcon },
  { to: '/profile', label: 'Profile', icon: ProfileIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
];

const adminNavItems = [
  { to: '/admin/users', label: 'Users', icon: UsersIcon },
  { to: '/admin/job-roles', label: 'Job Roles', icon: JobRolesIcon },
  { to: '/admin/analytics', label: 'Analytics', icon: AnalyticsIcon }
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const initials = (user?.fullName || 'U')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative flex min-h-screen bg-[var(--color-surface-alt)]">
      {/* Sidebar - desktop */}
      <aside className="gi-glass hidden w-64 shrink-0 flex-col border-r px-4 py-6 md:flex">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {isMobileNavOpen && (
        <div className="gi-fade-in fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileNavOpen(false)} />
          <aside className="gi-slide-right absolute left-0 top-0 h-full w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 shadow-2xl">
            <SidebarContent onNavigate={() => setIsMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="gi-glass sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <button
            type="button"
            className="focus-ring rounded-lg p-2 text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-alt)] md:hidden"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            {user?.role === 'admin' && <AdminNotificationBell />}
            <ThemeToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-[var(--color-text)]">{user?.fullName}</p>
              <p className="text-xs capitalize text-[var(--color-text-muted)]">{user?.role}</p>
            </div>
            <span
              className="gi-glow flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white"
              aria-hidden="true"
            >
              {initials}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="focus-ring rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="gi-fade-in flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();

  const linkClass = (isActive) =>
    `focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-gradient-to-r from-brand-500/15 to-accent-500/10 text-brand-700 dark:text-brand-200'
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]'
    }`;

  return (
    <>
      <div className="mb-8 flex items-center gap-2.5 px-1 font-bold tracking-tight text-[var(--color-text)]">
        <span className="gi-glow flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm text-white">
          GI
        </span>
        <span>Ghost Interview</span>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-accent-500" />
                )}
                <Icon />
                {label}
              </>
            )}
          </NavLink>
        ))}

        {user?.role === 'admin' && (
          <>
            <p className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Admin
            </p>
            {adminNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => linkClass(isActive)}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-brand-500 to-accent-500" />
                    )}
                    <Icon />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </>
  );
}

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.23.5.7.83 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function JobRolesIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-4" />
    </svg>
  );
}
