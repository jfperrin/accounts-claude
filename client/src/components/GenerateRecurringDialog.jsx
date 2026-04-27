import { useState } from 'react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const currentYear = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function GenerateRecurringDialog({ open, onConfirm, onCancel }) {
  const today = dayjs();
  const [month, setMonth] = useState(String(today.month() + 1));
  const [year, setYear] = useState(String(today.year()));

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({ month: Number(month), year: Number(year) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Générer les opérations récurrentes</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mois</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit">Générer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
