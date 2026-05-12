import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const ACCEPTED_EXT = /\.(qif|ofx|zip)$/i;

export default function ImportDialog({ open, banks, onSubmit, onCancel }) {
  const [bankId, setBankId] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const acceptFile = (f) => {
    if (!f) return;
    if (!ACCEPTED_EXT.test(f.name)) {
      setError('Format non supporté : .qif, .ofx ou .zip uniquement.');
      setFile(null);
      return;
    }
    setError('');
    setFile(f);
  };

  const handleInputChange = (e) => acceptFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file || !bankId) return;
    onSubmit(file, bankId);
  };

  const handleCancel = () => {
    setBankId('');
    setFile(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
    onCancel();
  };

  const clearFile = () => {
    setFile(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer un relevé</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Banque</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="import-file">Fichier QIF, OFX ou ZIP</Label>

            {/* Zone drop : clic ouvre le picker natif, drop accepte un fichier.
                État visuel distinct quand un fichier est sélectionné OU qu'un
                fichier est en cours de drag-over. */}
            <label
              htmlFor="import-file"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                dragOver
                  ? 'border-primary bg-primary/5 text-primary'
                  : file
                  ? 'border-credit/40 bg-credit/5'
                  : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
              )}
            >
              {file ? (
                <>
                  <FileText className="h-6 w-6 text-credit" aria-hidden />
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate max-w-[20ch]">{file.name}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); clearFile(); }}
                      className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Retirer le fichier"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} Ko · Clique pour remplacer
                  </span>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
                  <div className="text-sm font-medium">
                    {dragOver ? 'Dépose le fichier ici' : 'Glisse un fichier ou clique pour parcourir'}
                  </div>
                  <span className="text-xs text-muted-foreground">.qif, .ofx ou .zip — 1 Mo max</span>
                </>
              )}
              <input
                id="import-file"
                ref={fileRef}
                type="file"
                accept=".qif,.ofx,.zip,application/zip"
                onChange={handleInputChange}
                className="sr-only"
              />
            </label>

            {error && <p className="text-xs font-medium text-debit">{error}</p>}
          </div>

          <p className="text-xs text-muted-foreground">
            QIF ou OFX direct, ou ZIP contenant un de ces formats.
            Toutes les opérations du fichier sont importées (toutes dates),
            les doublons et lignes invalides sont ignorés.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>Annuler</Button>
            <Button type="submit" disabled={!bankId || !file}>
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
