import { useState } from 'react';
import { toast } from 'sonner';
import { setupTotp, enableTotp } from '@/api/mfa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import RecoveryCodesDialog from './RecoveryCodesDialog';

export default function TotpSetupDialog({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('init'); // 'init' | 'confirm' | 'done'
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);

  const errMsg = (e) => e?.message || e?.response?.data?.message || 'Erreur';

  const start = async () => {
    setLoading(true);
    try {
      const res = await setupTotp();
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
    setStep('init');
    setData(null);
    setCode('');
    onSuccess?.();
    onClose();
  };

  return (
    <>
      <Dialog open={open && step !== 'done'} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer l'application d'authentification</DialogTitle>
            <DialogDescription>
              {step === 'init' && "Un secret va être généré et associé à votre compte."}
              {step === 'confirm' && "Scannez le QR code dans votre application, puis saisissez un code généré."}
            </DialogDescription>
          </DialogHeader>

          {step === 'init' && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="button" disabled={loading} onClick={start}>
                {loading ? 'Génération…' : 'Commencer'}
              </Button>
            </DialogFooter>
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
