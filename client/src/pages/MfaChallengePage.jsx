import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Smartphone, Mail, Key } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Footer from '@/components/layout/Footer';

const errMsg = (e) => e?.message || e?.response?.data?.message || '';

export default function MfaChallengePage() {
  const { mfaChallenge, verifyMfa, cancelMfa, sendMfaEmail } = useAuth();
  const navigate = useNavigate();

  const [method, setMethod] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!mfaChallenge) navigate('/login', { replace: true });
  }, [mfaChallenge, navigate]);

  useEffect(() => {
    if (!mfaChallenge) return;
    if (mfaChallenge.methods.length === 1) {
      const only = mfaChallenge.methods[0];
      setMethod(only);
      if (only === 'email' && !emailSent) {
        sendMfaEmail().then(() => setEmailSent(true)).catch(() => {});
      }
    }
  }, [mfaChallenge, sendMfaEmail, emailSent]);

  if (!mfaChallenge) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyMfa(method, code);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = errMsg(err);
      if (/expir/i.test(msg)) {
        toast.error('Challenge expiré, reconnectez-vous.');
        navigate('/login', { replace: true });
        return;
      }
      setError(msg || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const chooseEmail = async () => {
    setMethod('email');
    try {
      await sendMfaEmail();
      setEmailSent(true);
      toast.success(`Code envoyé à ${mfaChallenge.email}`);
    } catch (err) {
      toast.error(errMsg(err) || 'Erreur');
    }
  };

  const cancel = async () => {
    await cancelMfa();
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-900">
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-105 rounded-2xl bg-white p-12 shadow-2xl">
          <div className="mb-9 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/40">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Vérification 2FA</h1>
            <p className="text-sm text-slate-500">Confirmez votre identité pour continuer.</p>
          </div>

          {method === null ? (
            <div className="space-y-3">
              {mfaChallenge.methods.includes('totp') && (
                <button
                  type="button"
                  onClick={() => setMethod('totp')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">Application d'authentification</div>
                    <div className="text-xs text-slate-500">Saisir le code à 6 chiffres</div>
                  </div>
                </button>
              )}
              {mfaChallenge.methods.includes('email') && (
                <button
                  type="button"
                  onClick={chooseEmail}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">Recevoir un code par email</div>
                    <div className="text-xs text-slate-500">Envoyé à {mfaChallenge.email}</div>
                  </div>
                </button>
              )}
              <button
                type="button"
                onClick={() => setMethod('recovery')}
                className="mt-2 w-full text-center text-xs text-slate-500 underline hover:text-slate-700"
              >
                <Key className="mr-1 inline h-3 w-3" /> Utiliser un code de récupération
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code" className="text-slate-700">
                  {method === 'totp' && "Code de l'application"}
                  {method === 'email' && (emailSent ? `Code envoyé à ${mfaChallenge.email}` : 'Envoi du code…')}
                  {method === 'recovery' && 'Code de récupération'}
                </Label>
                <Input
                  id="mfa-code"
                  inputMode={method === 'recovery' ? 'text' : 'numeric'}
                  required
                  autoFocus
                  maxLength={method === 'recovery' ? 12 : 6}
                  value={code}
                  onChange={(e) => setCode(method === 'recovery' ? e.target.value.toLowerCase() : e.target.value.replace(/\D/g, ''))}
                  className="h-11 bg-white text-slate-900 border-slate-200 placeholder:text-slate-400"
                />
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              )}
              <Button type="submit" className="h-11 w-full text-base shadow-md shadow-primary/30" disabled={loading}>
                {loading ? 'Vérification…' : 'Valider'}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setMethod(null); setCode(''); setError(''); }} className="text-slate-500 underline hover:text-slate-700">
                  Changer de méthode
                </button>
                <button type="button" onClick={cancel} className="text-slate-500 underline hover:text-slate-700">
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer className="relative z-10 border-white/10 bg-transparent text-slate-500" />
    </div>
  );
}
