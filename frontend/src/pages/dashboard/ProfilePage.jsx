import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth.api';
import { extractErrorMessage, extractFieldErrors } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initials = (user?.fullName || 'U')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setFieldErrors((f) => ({ ...f, [e.target.name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!form.currentPassword) errors.currentPassword = 'Current password is required';
    if (!PASSWORD_RULE.test(form.newPassword)) {
      errors.newPassword = 'At least 8 characters, with an uppercase, lowercase, and a number';
    }
    if (form.newPassword && form.newPassword === form.currentPassword) {
      errors.newPassword = 'Choose a password different from your current one';
    }
    if (form.confirmNewPassword !== form.newPassword) errors.confirmNewPassword = 'Passwords do not match';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      toast.success('Password updated. Please sign in again with your new password.');
      await logout();
    } catch (error) {
      setFieldErrors(extractFieldErrors(error));
      toast.error(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">Profile</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">Your account details and security settings.</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <span
            className="gi-glow flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[var(--color-text)]">{user?.fullName}</h2>
            <p className="text-sm capitalize text-[var(--color-text-muted)]">{user?.role} account</p>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Full name</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">{user?.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Email</dt>
            <dd className="mt-1 break-all text-sm font-medium text-[var(--color-text)]">{user?.email}</dd>
          </div>
          {user?.createdAt && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Member since</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">
                {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Account status</dt>
            <dd className="mt-1 text-sm font-medium capitalize text-[var(--color-text)]">{user?.status || 'active'}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Change password</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          For your security, you will be signed out of all devices after changing your password.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
          <Input
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={handleChange}
            error={fieldErrors.currentPassword}
          />
          <Input
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={handleChange}
            error={fieldErrors.newPassword}
            hint="At least 8 characters, including an uppercase letter, a lowercase letter, and a number."
          />
          <Input
            label="Confirm new password"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={form.confirmNewPassword}
            onChange={handleChange}
            error={fieldErrors.confirmNewPassword}
          />
          <div>
            <Button type="submit" isLoading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
