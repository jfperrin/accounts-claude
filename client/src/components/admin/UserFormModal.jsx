import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { email: '', password: '', role: 'user', emailVerified: false };

export default function UserFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial
        ? {
            email: initial.email ?? '',
            password: '',
            role: initial.role,
            emailVerified: !!initial.emailVerified,
          }
        : EMPTY
      );
      setError('');
    }
  }, [open, initial]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target?.value ?? e }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) {
      return setError('Email requis.');
    }
    if (!isEdit && form.password.length < 8) {
      return setError('Le mot de passe doit faire au moins 8 caractères.');
    }
    setSaving(true);
    try {
      const payload = isEdit
        ? { email: form.email, role: form.role, emailVerified: form.emailVerified }
        : { email: form.email, password: form.password, role: form.role, emailVerified: form.emailVerified };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="uf-email">Email</Label>
            <Input id="uf-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label htmlFor="uf-password">Mot de passe</Label>
              <Input id="uf-password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Rôle</Label>
            <Select value={form.role} onValueChange={set('role')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.emailVerified}
              onChange={(e) => setForm((f) => ({ ...f, emailVerified: e.target.checked }))}
              className="h-4 w-4 rounded border-input text-indigo-600 focus:ring-indigo-500"
            />
            <span>Email vérifié</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Créer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
