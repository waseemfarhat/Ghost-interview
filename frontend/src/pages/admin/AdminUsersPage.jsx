import { useEffect, useState } from 'react';
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'suspend'|'reactivate'|'delete', user }
  const [isActing, setIsActing] = useState(false);

  const loadUsers = async (page = 1, searchTerm = search) => {
    setIsLoading(true);
    try {
      const { data } = await adminApi.listUsers({ page, limit: 10, search: searchTerm || undefined });
      setUsers(data.data.items);
      setPagination(data.data.pagination);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers(1, search);
  };

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
      loadUsers(pagination.page);
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

      <form onSubmit={handleSearchSubmit} className="flex max-w-sm gap-2">
        <Input placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={28} />
          </div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No users found.</p>
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
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={(p) => loadUsers(p)} />
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
