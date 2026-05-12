import { useState } from 'react';
import { toast } from 'sonner';
import { setupTotp, enableTotp } from '@/api/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import RecoveryCodesDialog from './RecoveryCodesDialog';

export default function TotpSetupDialog({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('password'); // 'password' | 'confirm' | 'done'
  const [password, setPassword] = useState('');
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const errMsg = (e) => e?.message || e?.response?.data?.message || 'Erreur';

  const start = async () => {
    setLoading(true);
    try {
      const res = await setupTotp(password);
      setData(res);
      setStep('confirm');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      const res = await enableTotp(code);
      setRecoveryCodes(res.recoveryCodes);
      setStep('done');
    } catch (e) {
      toast.error(errMsg(e) || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const finishAll = () => {
    setRecoveryCodes(null);
    setStep('password');
    setPassword('');
    setData(null);
    setCode('');
    onSuccess?.();
    onClose();
  };

  const close = () => {
    setPassword('');
    setData(null);
    setCode('');
    setStep('password');
    onClose();
  };

  return (
    <>
      <Dialog open={open && step !== 'done'} onOpenChange={(v) => { if (!v) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer l'application d'authentification</DialogTitle>
            <DialogDescription>
              {step === 'password' && 'Confirmez votre mot de passe pour générer un secret 2FA.'}
              {step === 'confirm' && "Scannez le QR code dans votre application, puis saisissez un code généré."}
            </DialogDescription>
          </DialogHeader>

          {step === 'password' && (
            <form onSubmit={(e) => { e.preventDefault(); if (password) start(); }} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="totp-setup-pwd">Mot de passe</Label>
                <Input
                  id="totp-setup-pwd"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Annuler</Button>
                <Button type="submit" disabled={loading || !password}>
                  {loading ? 'Génération…' : 'Continuer'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === 'confirm' && data && (
            <>
              <div className="flex flex-col items-center gap-3">
                <img src={data.qrCodeDataUrl} alt="QR code TOTP" className="h-48 w-48 rounded-lg border border-border" />
                <div className="text-xs text-muted-foreground">Ou saisissez le secret manuellement :</div>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{data.secret}</code>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totp-code">Code à 6 chiffres</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close}>Annuler</Button>
                <Button type="button" disabled={loading || code.length !== 6} onClick={confirm}>
                  {loading ? 'Vérification…' : 'Activer'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <RecoveryCodesDialog
        open={step === 'done'}
        codes={recoveryCodes}
        onClose={finishAll}
      />
    </>
  );
}
