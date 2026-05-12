import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, ShieldOff, MailCheck, CheckCircle2, XCircle, Smartphone, Mail } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import {
  getUsers, createUser, updateUser, deleteUser, sendReset, verifyEmail,
  disableTotp, disableEmailMfa,
} from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import UserFormModal from '@/components/admin/UserFormModal';

function GoogleIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 14l7.9 6.1C12.4 14.1 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 2.8-2.1 5.2-4.5 6.8l7.2 5.6c4.2-3.9 6.6-9.6 6.6-16.9z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.6 2.2-8.7 2.2-6.3 0-11.6-4.6-13.5-10.6l-7.9 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  );
}

export default function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mfaTarget, setMfaTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch {
      toast.error('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    const created = await createUser(data);
    setUsers(prev => [created, ...prev]);
    toast.success(`Utilisateur "${created.email}" créé.`);
  };

  const handleEdit = async (data) => {
    const updated = await updateUser(editing._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('Utilisateur mis à jour.');
  };

  const handleDelete = async () => {
    try {
      await deleteUser(deleteTarget._id);
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      toast.success(`Utilisateur "${deleteTarget.email}" supprimé.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReset = async (u) => {
    try {
      await sendReset(u._id);
      toast.success(`Email de réinitialisation envoyé à ${u.email}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi.');
    }
  };

  const handleVerify = async (u) => {
    try {
      const updated = await verifyEmail(u._id);
      setUsers(prev => prev.map(x => x._id === updated._id ? updated : x));
      toast.success(`Email de ${u.email} vérifié.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const handleRevokeMfa = async (factor) => {
    if (!mfaTarget) return;
    try {
      const fn = factor === 'totp' ? disableTotp : disableEmailMfa;
      const updated = await fn(mfaTarget._id);
      setUsers(prev => prev.map(x => x._id === updated._id ? updated : x));
      setMfaTarget(updated);
      toast.success(factor === 'totp' ? 'TOTP révoqué.' : 'MFA email révoqué.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la révocation.');
    }
  };

  const isSelf = (u) => u._id === (me?._id ?? me?.id);

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Administration des utilisateurs</h1>
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
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Vérifié</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">2FA</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u._id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {u.email}
                    {isSelf(u) && <span className="ml-2 text-xs text-muted-foreground">(vous)</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.isGoogle ? (
                      <GoogleIcon className="h-4 w-4" />
                    ) : u.emailVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {(u.totpEnabled || u.emailMfaEnabled) ? (
                      <div className="flex items-center gap-1">
                        {u.totpEnabled && (
                          <Badge variant="secondary" className="gap-1 text-[10px]" title="TOTP actif">
                            <Smartphone className="h-3 w-3" /> TOTP
                          </Badge>
                        )}
                        {u.emailMfaEnabled && (
                          <Badge variant="secondary" className="gap-1 text-[10px]" title="MFA par email actif">
                            <Mail className="h-3 w-3" /> Email
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => { setEditing(u); setModalOpen(true); }}
                            aria-label="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Modifier</TooltipContent>
                      </Tooltip>
                      {u.email && !u.isGoogle && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => handleReset(u)}
                              aria-label="Réinitialiser le mot de passe"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Réinitialiser le mot de passe</TooltipContent>
                        </Tooltip>
                      )}
                      {!u.emailVerified && !u.isGoogle && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => handleVerify(u)}
                              aria-label="Vérifier l'email"
                            >
                              <MailCheck className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Vérifier l'email</TooltipContent>
                        </Tooltip>
                      )}
                      {(u.totpEnabled || u.emailMfaEnabled) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setMfaTarget(u)}
                              aria-label="Révoquer le 2FA"
                              className="text-amber-600 hover:text-amber-700"
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Révoquer le 2FA</TooltipContent>
                        </Tooltip>
                      )}
                      {!isSelf(u) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setDeleteTarget(u)}
                              aria-label="Supprimer"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                      )}
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

      <Dialog open={!!mfaTarget} onOpenChange={(o) => !o && setMfaTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Révoquer le 2FA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Compte <strong>{mfaTarget?.email}</strong>. Révoquer un facteur force l'utilisateur
              à le reconfigurer. Les codes de récupération sont purgés si plus aucun facteur n'est actif.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span>Application TOTP</span>
                  {mfaTarget?.totpEnabled
                    ? <Badge variant="secondary" className="text-[10px]">actif</Badge>
                    : <span className="text-xs text-muted-foreground">inactif</span>}
                </div>
                <Button
                  variant="outline" size="sm"
                  disabled={!mfaTarget?.totpEnabled}
                  onClick={() => handleRevokeMfa('totp')}
                >
                  Révoquer
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>Code par email</span>
                  {mfaTarget?.emailMfaEnabled
                    ? <Badge variant="secondary" className="text-[10px]">actif</Badge>
                    : <span className="text-xs text-muted-foreground">inactif</span>}
                </div>
                <Button
                  variant="outline" size="sm"
                  disabled={!mfaTarget?.emailMfaEnabled}
                  onClick={() => handleRevokeMfa('email')}
                >
                  Révoquer
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMfaTarget(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement <strong>{deleteTarget?.email}</strong> et toutes ses données (banques, opérations, périodes). Elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
