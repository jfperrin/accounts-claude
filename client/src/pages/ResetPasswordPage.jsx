import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/api/client';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('checking'); // checking | valid | invalid | done | error
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get(`/auth/reset-password/${token}`)
      .then(() => setStatus('valid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.password.length < 8) return setErrorMsg('Le mot de passe doit faire au moins 8 caractères.');
    if (form.password !== form.confirm) return setErrorMsg('Les mots de passe ne correspondent pas.');
    setSaving(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Erreur, veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Comptes</span>
        </div>

        {status === 'checking' && (
          <p className="text-center text-muted-foreground">Vérification du lien…</p>
        )}

        {status === 'invalid' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">Ce lien est invalide ou a expiré.</p>
            <p className="text-xs text-muted-foreground">Contactez un administrateur pour obtenir un nouveau lien.</p>
          </div>
        )}

        {status === 'valid' && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-bold text-center">Nouveau mot de passe</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rp-password">Mot de passe</Label>
                <Input
                  id="rp-password" type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rp-confirm">Confirmer</Label>
                <Input
                  id="rp-confirm" type="password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Changer le mot de passe'}
              </Button>
            </form>
          </div>
        )}

        {status === 'done' && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <p className="font-medium">Mot de passe mis à jour !</p>
            <Button asChild className="w-full">
              <Link to="/login">Se connecter</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
