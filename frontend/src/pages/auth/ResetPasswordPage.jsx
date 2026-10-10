import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../../api/auth.api';
import { extractErrorMessage, extractFieldErrors } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <Card className="p-6 text-center sm:p-8">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Invalid reset link</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          This password reset link is missing its token. Please request a new one.
        </p>
        <Link to="/forgot-password" className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline">
          Request a new link
        </Link>
      </Card>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!PASSWORD_RULE.test(form.password)) {
      errors.password = 'At least 8 characters, with an uppercase, lowercase, and a number';
    }
    if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ token, password: form.password });
      toast.success('Password reset. Please log in.');
      navigate('/login', { replace: true });
    } catch (error) {
      setFieldErrors(extractFieldErrors(error));
      toast.error(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-[var(--color-text)]">Set a new password</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Choose a strong new password for your account.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={fieldErrors.password}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          error={fieldErrors.confirmPassword}
        />
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Reset password
        </Button>
      </form>
    </Card>
  );
}
