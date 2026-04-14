import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Globe, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { config as fetchConfig, resendVerification } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const REMEMBER_OPTIONS = [
  { label: '1 jour', value: 1 },
  { label: '1 mois', value: 30 },
  { label: '1 an', value: 365 },
];

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberDays, setRememberDays] = useState(30);
  const [registered, setRegistered] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';
  const emailTaken = searchParams.get('error') === 'email_taken';
  const tokenExpired = searchParams.get('error') === 'token_expired';
  const verified = searchParams.get('verified') === '1';
  const passwordCancelled = searchParams.get('password_cancelled') === '1';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverifiedEmail(null);
    setResendDone(false);
    try {
      if (tab === 'login') {
        await login({ ...form, rememberDays });
      } else {
        await register(form);
        setRegistered(true);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setUnverifiedEmail(form.email);
      } else {
        toast.error(err.response?.data?.message || err.message || 'Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
        <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900">Vérifiez votre email</h1>
          <p className="mb-6 text-sm text-slate-500">
            Un lien d'activation a été envoyé à <strong>{form.email}</strong>. Cliquez dessus pour activer votre compte.
          </p>
          <button
            type="button"
            onClick={() => { setRegistered(false); setTab('login'); }}
            className="text-sm text-indigo-600 hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
      <div className="pointer-events-none absolute -right-20 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_65%)]" />

      <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Gestion de Comptes</h1>
          <p className="text-sm text-slate-500">Gérez vos finances en toute sérénité</p>
        </div>

        {verified && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Email vérifié avec succès. Vous pouvez maintenant vous connecter.
          </div>
        )}

        {passwordCancelled && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Votre changement de mot de passe a été annulé. Vous pouvez vous connecter avec votre ancien mot de passe.
          </div>
        )}

        {googleError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Échec de la connexion Google
          </div>
        )}

        {emailTaken && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Cette adresse email est déjà utilisée par un autre compte.
          </div>
        )}

        {tokenExpired && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Ce lien est expiré ou invalide. Demandez-en un nouveau depuis votre profil.
          </div>
        )}

        {unverifiedEmail && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p>Email non vérifié. Un nouveau lien d'activation vient de vous être envoyé.</p>
            {resendDone ? (
              <p className="mt-2 font-medium">Email renvoyé !</p>
            ) : (
              <button
                type="button"
                disabled={resendLoading}
                className="mt-2 font-medium underline disabled:opacity-50"
                onClick={async () => {
                  setResendLoading(true);
                  try { await resendVerification(unverifiedEmail); setResendDone(true); }
                  catch { toast.error('Erreur lors du renvoi'); }
                  finally { setResendLoading(false); }
                }}
              >
                {resendLoading ? 'Envoi…' : "Renvoyer l'email de vérification"}
              </button>
            )}
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

        <div className="mb-7 flex gap-1 rounded-xl bg-slate-100 p-1">
          {[['login', 'Connexion'], ['register', 'Inscription']].map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => { setTab(key); setForm({ email: '', password: '' }); setUnverifiedEmail(null); setRememberDays(30); }}
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
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
          {tab === 'login' && (
            <div className="space-y-1.5">
              <Label id="remember-label">Rester connecté</Label>
              <div
                className="flex gap-1 rounded-xl bg-slate-100 p-1"
                role="group"
                aria-labelledby="remember-label"
              >
                {REMEMBER_OPTIONS.map(({ label, value }) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setRememberDays(value)}
                    aria-pressed={rememberDays === value}
                    className={cn(
                      'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                      rememberDays === value
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
