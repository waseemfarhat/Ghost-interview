import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner } from '../../components/ui/Spinner';
import { DateRangeFilter, FieldLabel, compactParams, selectClass, useUrlFilters } from './adminShared';

export default function AdminUsersPage() {
  const [filters, setFilters] = useUrlFilters({ search: '', role: '', status: '', from: '', to: '' });
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState(filters.search);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'suspend'|'reactivate'|'delete', user }
  const [isActing, setIsActing] = useState(false);

  useEffect(() => setSearch(filters.search), [filters.search]);

  const { role, status, from, to, page } = filters;
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminApi.listUsers(
        compactParams({ page, limit: 10, search: filters.search, role, status, from, to })
      );
      setUsers(data.data.items);
      setPagination(data.data.pagination);
    } catch (error) {
      setLoadError(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [page, filters.search, role, status, from, to]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters({ search: search.trim() });
  };
  const hasFilters = filters.search || role || status || from || to;

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setIsActing(true);
    try {
      if (confirmAction.type === 'delete') {
        await adminApi.deleteUser(confirmAction.user.id);
        toast.success('User deleted');
      } else {
        const nextStatus = confirmAction.type === 'suspend' ? 'suspended' : 'active';
        await adminApi.updateUserStatus(confirmAction.user.id, nextStatus);
        toast.success(`User ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
      }
      setConfirmAction(null);
      loadUsers();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">User management</h1>
        <p className="mt-1 text-[var(--color-text-muted)]">View, suspend, or remove candidate accounts.</p>
      </div>

      <Card className="p-4 sm:p-5">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto] lg:items-end"
        >
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="user-search">Search</FieldLabel>
            <Input id="user-search" type="search" placeholder="Name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="user-role">Role</FieldLabel>
            <select id="user-role" className={selectClass} value={role} onChange={(e) => setFilters({ role: e.target.value })}>
              <option value="">All roles</option>
              <option value="candidate">Candidates</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="user-status">Status</FieldLabel>
            <select id="user-status" className={selectClass} value={status} onChange={(e) => setFilters({ status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <DateRangeFilter from={from} to={to} onChange={setFilters} />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {hasFilters && (
          <button
            type="button"
            className="focus-ring mt-3 rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
            onClick={() => setFilters({ search: '', role: '', status: '', from: '', to: '' })}
          >
            Clear filters
          </button>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        {!isLoading && !loadError && (
          <p className="mb-3 text-sm text-[var(--color-text-muted)]" aria-live="polite">
            {pagination.total} user{pagination.total === 1 ? '' : 's'}
          </p>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8" role="status">
            <Spinner size={28} />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={loadUsers}>
              Try again
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
            {hasFilters ? 'No users match these filters.' : 'No users found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 pr-4 font-medium">Interviews</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-alt)]">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500/20 to-accent-500/20 text-xs font-bold text-brand-600 dark:text-brand-300">
                          {(u.fullName || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <span className="font-medium text-[var(--color-text)]">{u.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.role === 'admin' ? 'brand' : 'neutral'}>{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {u.interviewCount ? (
                        <Link
                          to={`/admin/interviews?user=${u.id}`}
                          className="focus-ring rounded font-medium text-brand-600 hover:underline dark:text-brand-300"
                          aria-label={`${u.interviewCount} interviews by ${u.fullName}, ${u.completedInterviewCount} completed`}
                        >
                          {u.interviewCount} ({u.completedInterviewCount} completed)
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0</span>
                      )}
                    </td>
                    <td className="py-3">
                      {u.role !== 'admin' && (
                        <div className="flex gap-2">
                          {u.status === 'suspended' ? (
                            <Button size="sm" variant="secondary" onClick={() => setConfirmAction({ type: 'reactivate', user: u })}>
                              Reactivate
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => setConfirmAction({ type: 'suspend', user: u })}>
                              Suspend
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => setConfirmAction({ type: 'delete', user: u })}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => setFilters({ page: p }, { resetPage: false })}
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmAction}
        title={
          confirmAction?.type === 'delete'
            ? `Delete ${confirmAction.user.fullName}?`
            : confirmAction?.type === 'suspend'
              ? `Suspend ${confirmAction.user.fullName}?`
              : `Reactivate ${confirmAction?.user.fullName}?`
        }
        description={
          confirmAction?.type === 'delete'
            ? 'This will soft-delete the account. The user will no longer be able to log in.'
            : confirmAction?.type === 'suspend'
              ? 'This user will be logged out everywhere and unable to log in until reactivated.'
              : 'This user will be able to log in again.'
        }
        confirmLabel={confirmAction?.type === 'delete' ? 'Delete' : confirmAction?.type === 'suspend' ? 'Suspend' : 'Reactivate'}
        variant={confirmAction?.type === 'reactivate' ? 'primary' : 'danger'}
        isLoading={isActing}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
