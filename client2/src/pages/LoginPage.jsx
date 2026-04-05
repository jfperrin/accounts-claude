import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { config as fetchConfig } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [form, setForm] = useState({ username: '', password: '' });
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      tab === 'login' ? await login(form) : await register(form);
    } catch (err) {
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -right-20 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_65%)]" />

      {/* Card */}
      <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl">
        {/* Brand */}
        <div className="mb-9 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Gestion de Comptes</h1>
          <p className="text-sm text-slate-500">Gérez vos finances en toute sérénité</p>
        </div>

        {googleError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Échec de la connexion Google
          </div>
        )}

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full gap-2"
              size="lg"
              onClick={() => { window.location.href = '/api/auth/google'; }}
            >
              <Globe className="h-4 w-4" />
              Continuer avec Google
            </Button>
            <div className="relative mb-4 flex items-center gap-3">
              <span className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400">ou</span>
              <span className="flex-1 border-t border-slate-200" />
            </div>
          </>
        )}

        {/* Tab toggle */}
        <div className="mb-7 flex gap-1 rounded-xl bg-slate-100 p-1">
          {[['login', 'Connexion'], ['register', 'Inscription']].map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => { setTab(key); setForm({ username: '', password: '' }); }}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                tab === key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Nom d'utilisateur</Label>
            <Input
              id="username"
              autoFocus
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="mt-2 h-11 w-full text-base shadow-md shadow-indigo-500/30"
            disabled={loading}
          >
            {loading ? 'Chargement…' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>
      </div>
    </div>
  );
}
