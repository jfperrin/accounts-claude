import { useState } from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function RecoveryCodesDialog({ open, codes, onClose }) {
  const [acknowledged, setAcknowledged] = useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      toast.success('Codes copiés');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && acknowledged) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Codes de récupération</DialogTitle>
          <DialogDescription>
            Sauvegardez ces 10 codes maintenant. Chacun ne peut être utilisé qu'une seule fois.
            Ils ne seront plus jamais affichés.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm">
          {(codes || []).map((c) => <div key={c}>{c}</div>)}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={copyAll}>
            <Copy className="mr-2 h-4 w-4" /> Copier
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={downloadTxt}>
            <Download className="mr-2 h-4 w-4" /> Télécharger .txt
          </Button>
        </div>

        <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-ring"
          />
          <span>J'ai sauvegardé ces codes en lieu sûr.</span>
        </label>

        <DialogFooter>
          <Button type="button" disabled={!acknowledged} onClick={onClose}>
            <Check className="mr-2 h-4 w-4" /> J'ai terminé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
