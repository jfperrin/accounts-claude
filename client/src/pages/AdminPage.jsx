import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import * as adminApi from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import UserFormModal from '@/components/admin/UserFormModal';

export default function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.getUsers());
    } catch {
      toast.error('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    const created = await adminApi.createUser(data);
    setUsers(prev => [created, ...prev]);
    toast.success(`Utilisateur "${created.username}" créé.`);
  };

  const handleEdit = async (data) => {
    const updated = await adminApi.updateUser(editing._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('Utilisateur mis à jour.');
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Supprimer définitivement "${u.username}" et toutes ses données ?`)) return;
    try {
      await adminApi.deleteUser(u._id);
      setUsers(prev => prev.filter(x => x._id !== u._id));
      toast.success(`Utilisateur "${u.username}" supprimé.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression.');
    }
  };

  const handleReset = async (u) => {
    try {
      await adminApi.sendReset(u._id);
      toast.success(`Email de réinitialisation envoyé à ${u.email}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi.');
    }
  };

  const isSelf = (u) => u._id === (me?._id ?? me?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold">Administration — Utilisateurs</h1>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel utilisateur
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Utilisateur</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u._id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {isSelf(u) && <span className="ml-2 text-xs text-muted-foreground">(vous)</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { setEditing(u); setModalOpen(true); }}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        disabled={!u.email}
                        onClick={() => handleReset(u)}
                        title="Réinitialiser le mot de passe"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        disabled={isSelf(u)}
                        onClick={() => handleDelete(u)}
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={editing ? handleEdit : handleCreate}
        initial={editing}
      />
    </div>
  );
}
