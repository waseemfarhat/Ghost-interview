import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { jobRolesApi } from '../../api/jobRoles.api';
import { extractErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Spinner } from '../../components/ui/Spinner';

const emptyForm = { roleName: '', category: '', description: '', questions: [''] };

export default function AdminJobRolesPage() {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalState, setModalState] = useState(null); // { mode: 'create'|'edit', role }
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const { data } = await jobRolesApi.list({ limit: 100, includeInactive: true });
      setRoles(data.data.items);
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModalState({ mode: 'create' });
  };

  const openEdit = (role) => {
    setForm({
      roleName: role.roleName,
      category: role.category,
      description: role.description || '',
      questions: role.questionBank?.map((q) => q.text) || ['']
    });
    setModalState({ mode: 'edit', role });
  };

  const updateQuestion = (index, value) => {
    setForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === index ? value : q)) }));
  };

  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, ''] }));

  const removeQuestion = (index) => {
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const questions = form.questions.map((q) => q.trim()).filter(Boolean);
    if (!form.roleName.trim() || !form.category.trim() || questions.length === 0) {
      toast.error('Role name, category, and at least one question are required.');
      return;
    }

    const payload = {
      roleName: form.roleName.trim(),
      category: form.category.trim(),
      description: form.description.trim() || undefined,
      questionBank: questions.map((text, order) => ({ text, order }))
    };

    setIsSaving(true);
    try {
      if (modalState.mode === 'create') {
        await jobRolesApi.create(payload);
        toast.success('Job role created');
      } else {
        await jobRolesApi.update(modalState.role._id, payload);
        toast.success('Job role updated');
      }
      setModalState(null);
      loadRoles();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await jobRolesApi.remove(deactivateTarget._id);
      toast.success('Job role deactivated');
      setDeactivateTarget(null);
      loadRoles();
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-3xl">Job roles</h1>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Manage the roles and interview questions candidates can practice with.
          </p>
        </div>
        <Button onClick={openCreate}>Add job role</Button>
      </div>

      <Card className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size={28} className="text-brand-500" />
          </div>
        ) : roles.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No job roles yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Questions</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role._id} className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-surface-alt)]">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text)]">{role.roleName}</td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{role.category}</td>
                    <td className="py-3 pr-4 text-[var(--color-text-muted)]">{role.questionBank?.length || 0}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={role.isActive ? 'success' : 'neutral'}>{role.isActive ? 'active' : 'inactive'}</Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(role)}>
                          Edit
                        </Button>
                        {role.isActive && (
                          <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(role)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!modalState}
        title={modalState?.mode === 'create' ? 'Add job role' : 'Edit job role'}
        onClose={() => setModalState(null)}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <Input
            label="Role name"
            value={form.roleName}
            onChange={(e) => setForm((f) => ({ ...f, roleName: e.target.value }))}
            required
          />
          <Input
            label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
            <textarea
              className="focus-ring min-h-[4rem] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-sm text-[var(--color-text)]"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Interview questions</label>
            <div className="mt-2 flex flex-col gap-2">
              {form.questions.map((q, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={q}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    placeholder={`Question ${index + 1}`}
                    className="flex-1"
                  />
                  {form.questions.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeQuestion(index)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addQuestion}>
              Add question
            </Button>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalState(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {modalState?.mode === 'create' ? 'Create role' : 'Save changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        title={`Deactivate ${deactivateTarget?.roleName}?`}
        description="Candidates will no longer be able to start new interviews for this role. Past sessions and reports are unaffected."
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}
