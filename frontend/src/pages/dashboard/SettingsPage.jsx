import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await authApi.logoutAll();
      await logout();
      toast.success('Logged out of all devices');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">Settings</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">Preferences and account security.</p>
      </div>

      <Card className="flex items-center justify-between p-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Appearance</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Currently using <span className="font-medium capitalize">{theme}</span> mode.
          </p>
        </div>
        <Button variant="secondary" onClick={toggleTheme}>
          Switch to {theme === 'dark' ? 'light' : 'dark'} mode
        </Button>
      </Card>

      <Card className="flex items-center justify-between p-6">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">Sessions</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Sign out of Ghost Interview on every device where you're currently logged in.
          </p>
        </div>
        <Button variant="danger" onClick={handleLogoutAll} isLoading={isLoggingOutAll}>
          Log out everywhere
        </Button>
      </Card>
    </div>
  );
}
