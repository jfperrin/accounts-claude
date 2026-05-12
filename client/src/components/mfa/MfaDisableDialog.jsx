import { useState } from 'react';
import { toast } from 'sonner';
import { disableTotp, disableEmailMfa, sendDisableEmail } from '@/api/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function MfaDisableDialog({ open, onClose, onSuccess, target, availableMethods }) {
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState(availableMethods?.[0] ?? 'totp');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const errMsg = (e) => e?.message || e?.response?.data?.message || 'Erreur';

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (target === 'totp') await disableTotp(password, code);
      else await disableEmailMfa(password, code);
      toast.success('2FA désactivé');
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const requestDisableEmail = async () => {
    setSendingEmail(true);
    try {
      await sendDisableEmail();
      toast.success('Code envoyé par email');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSendingEmail(false);
    }
  };

  const reset = () => { setPassword(''); setCode(''); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Désactiver le 2FA — {target === 'totp' ? 'Application' : 'Email'}</DialogTitle>
          <DialogDescription>
            Confirmez avec votre mot de passe et un code 2FA valide.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="disable-pwd">Mot de passe</Label>
            <Input
              id="disable-pwd"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {availableMethods?.length > 1 && (
            <div className="space-y-1.5">
              <Label>Méthode</Label>
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {availableMethods.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setMethod(m)}
                    aria-pressed={method === m}
                    className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition-all ${method === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {m === 'totp' ? 'Authenticator' : m === 'email' ? 'Email' : 'Recovery'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {method === 'email' && (
            <Button type="button" variant="outline" disabled={sendingEmail} onClick={requestDisableEmail}>
              {sendingEmail ? 'Envoi…' : 'Recevoir un code par email'}
            </Button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="disable-code">Code {method === 'recovery' ? 'de récupération' : 'à 6 chiffres'}</Label>
            <Input
              id="disable-code"
              inputMode={method === 'recovery' ? 'text' : 'numeric'}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Désactivation…' : 'Désactiver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
