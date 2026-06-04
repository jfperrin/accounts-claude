import dayjs from 'dayjs';

export default function SummaryCard({ summary, meta }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-2 text-sm font-semibold">Synthèse</h2>
      <p className="whitespace-pre-line text-sm text-foreground">{summary}</p>
      {meta?.cachedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          Généré le {dayjs(meta.cachedAt).format('DD/MM/YYYY HH:mm')} · {meta.model}
        </p>
      )}
    </section>
  );
}
