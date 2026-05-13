import { useState } from 'react';
import { Shield, ShieldCheck, Mail, Smartphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { regenerateRecovery } from '@/api/mfa';
import { me as fetchMe } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import TotpSetupDialog from './TotpSetupDialog';
import EmailMfaSetupDialog from './EmailMfaSetupDialog';
import MfaDisableDialog from './MfaDisableDialog';
import RecoveryCodesDialog from './RecoveryCodesDialog';

const errMsg = (e) => e?.message || e?.response?.data?.message || 'Erreur';

export default function MfaSection() {
  const { user, updateUser } = useAuth();
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [disableTarget, setDisableTarget] = useState(null);
  const [showRegen, setShowRegen] = useState(false);
  const [newCodes, setNewCodes] = useState(null);

  const reloadUser = async () => {
    const u = await fetchMe();
    updateUser(u);
  };

  const onTotpEnabled  = () => reloadUser();
  const onEmailEnabled = () => reloadUser();
  const onDisabled     = () => reloadUser();

  const availableForDisable = () => {
    const methods = [];
    if (user.totpEnabled) methods.push('totp');
    if (user.emailMfaEnabled) methods.push('email');
    if (user.recoveryCodesRemaining > 0) methods.push('recovery');
    return methods;
  };

  const anyEnabled = user.totpEnabled || user.emailMfaEnabled;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">Authentification à deux facteurs</h2>
      </div>

      <FactorRow
        icon={<Smartphone className="h-5 w-5" />}
        label="Application d'authentification"
        enabled={user.totpEnabled}
        onEnable={() => setShowTotpSetup(true)}
        onDisable={() => setDisableTarget('totp')}
      />

      <FactorRow
        icon={<Mail className="h-5 w-5" />}
        label="Code par email"
        enabled={user.emailMfaEnabled}
        onEnable={() => setShowEmailSetup(true)}
        onDisable={() => setDisableTarget('email')}
      />

      {anyEnabled && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <div>
            <div className="font-medium">Codes de récupération</div>
            <div className="text-muted-foreground">{user.recoveryCodesRemaining} restant{user.recoveryCodesRemaining > 1 ? 's' : ''}</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setShowRegen(true)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Régénérer
          </Button>
        </div>
      )}

      <TotpSetupDialog open={showTotpSetup} onClose={() => setShowTotpSetup(false)} onSuccess={onTotpEnabled} />
      <EmailMfaSetupDialog open={showEmailSetup} onClose={() => setShowEmailSetup(false)} onSuccess={onEmailEnabled} userEmail={user.email} />

      {disableTarget && (
        <MfaDisableDialog
          open={!!disableTarget}
          target={disableTarget}
          availableMethods={availableForDisable()}
          onClose={() => setDisableTarget(null)}
          onSuccess={onDisabled}
        />
      )}

      {showRegen && (
        <RegenerateDialog
          open={showRegen}
          onClose={() => setShowRegen(false)}
          onCodes={(codes) => { setNewCodes(codes); setShowRegen(false); }}
        />
      )}

      <RecoveryCodesDialog
        open={!!newCodes}
        codes={newCodes || []}
        onClose={() => { setNewCodes(null); reloadUser(); }}
      />
    </section>
  );
}

function FactorRow({ icon, label, enabled, onEnable, onDisable }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-sm font-medium">{label}</div>
        {enabled && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> Activé
          </span>
        )}
      </div>
      {enabled ? (
        <Button type="button" variant="outline" size="sm" onClick={onDisable}>Désactiver</Button>
      ) : (
        <Button type="button" size="sm" onClick={onEnable}>{label.includes('Application') ? 'Configurer' : 'Activer'}</Button>
      )}
    </div>
  );
}

function RegenerateDialog({ open, onClose, onCodes }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await regenerateRecovery(password, code);
      onCodes(res.recoveryCodes);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Régénérer les codes de récupération</DialogTitle>
          <DialogDescription>
            Les anciens codes seront invalidés. Vous obtiendrez 10 nouveaux codes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="regen-pwd">Mot de passe</Label>
            <Input id="regen-pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regen-code">Code 2FA actuel (TOTP ou email)</Label>
            <Input id="regen-code" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Génération…' : 'Régénérer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
