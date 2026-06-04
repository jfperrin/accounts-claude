import { AlertTriangle } from 'lucide-react';

export default function AnomaliesList({ anomalies, categories }) {
  if (!anomalies?.length) return null;
  const catLabel = (id) => categories.find((c) => String(c._id) === String(id))?.label;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Anomalies détectées</h2>
      <ul className="space-y-2">
        {anomalies.map((a, i) => (
          <li key={i} className="flex gap-2 rounded-lg border border-border bg-background p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-debit" />
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-muted-foreground">{a.detail}</div>
              {a.categoryId && catLabel(a.categoryId) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Catégorie : {catLabel(a.categoryId)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
