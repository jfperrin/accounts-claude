import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function ImportDialog({ open, banks, onSubmit, onCancel }) {
  const [bankId, setBankId] = useState('');
  const fileRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !bankId) return;
    onSubmit(file, bankId);
  };

  const handleCancel = () => {
    setBankId('');
    if (fileRef.current) fileRef.current.value = '';
    onCancel();
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
            <input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".qif,.ofx,.zip,application/zip"
              required
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            QIF ou OFX direct, ou ZIP contenant un de ces formats.
            Toutes les opérations du fichier sont importées (toutes dates),
            les doublons et lignes invalides sont ignorés.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>Annuler</Button>
            <Button type="submit" disabled={!bankId}>
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
