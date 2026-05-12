import { useState } from 'react';
import { toast } from 'sonner';
import { setupEmailMfa, enableEmailMfa } from '@/api/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import RecoveryCodesDialog from './RecoveryCodesDialog';

export default function EmailMfaSetupDialog({ open, onClose, onSuccess, userEmail }) {
  const [step, setStep] = useState('init');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const errMsg = (e) => e?.message || e?.response?.data?.message || 'Erreur';

  const sendCode = async () => {
    setLoading(true);
    try {
      await setupEmailMfa();
      toast.success(`Code envoyé à ${userEmail}`);
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
      const res = await enableEmailMfa(code);
      if (res.recoveryCodes) {
        setRecoveryCodes(res.recoveryCodes);
        setStep('done');
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const finishAll = () => {
    setRecoveryCodes(null);
    setStep('init');
    setCode('');
    onSuccess?.();
    onClose();
  };

  return (
    <>
      <Dialog open={open && step !== 'done'} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer le 2FA par email</DialogTitle>
            <DialogDescription>
              {step === 'init' && `Un code va être envoyé à ${userEmail}.`}
              {step === 'confirm' && 'Saisissez le code à 6 chiffres reçu par email.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'init' && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="button" disabled={loading} onClick={sendCode}>
                {loading ? 'Envoi…' : 'Envoyer le code'}
              </Button>
            </DialogFooter>
          )}

          {step === 'confirm' && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="email-mfa-code">Code à 6 chiffres</Label>
                <Input
                  id="email-mfa-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
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
