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
      toast.success('Password changed. Please log in again.');
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
        <h2 className="text-base font-semibold text-[var(--color-text)]">Account details</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Full name</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">{user?.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Email</dt>
            <dd className="mt-1 text-sm font-medium text-[var(--color-text)]">{user?.email}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold text-[var(--color-text)]">Change password</h2>
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
