import dayjs from 'dayjs';

// Construit la suite d'items à rendre dans une timeline d'opérations.
// Entrée : tableau d'ops (et de previews déjà mergés en amont).
// Sortie : tableau plat d'items avec un `type` :
//   - 'section' { label }           (séparateur « À VENIR »)
//   - 'day'     { date, label }     (en-tête de jour)
//   - 'op'      { op }              (ligne d'opération)
//
// Tri : date desc par défaut (futur en haut, passé en bas). Le séparateur
// « À VENIR » est inséré juste avant le premier jour > today si applicable.
//
// Les previews de récurrentes sont reconnues à `op.isPreview === true` —
// l'appelant est responsable de leur fusion dans `items`.

const MONTHS_FR = [
  'janv.', 'févr.', 'mars', 'avril', 'mai', 'juin',
  'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function formatDayLabel(date, today) {
  const d = dayjs(date);
  if (d.isSame(today, 'day')) return "Aujourd'hui";
  if (d.isSame(today.subtract(1, 'day'), 'day')) return 'Hier';
  if (d.isSame(today.add(1, 'day'), 'day')) return 'Demain';
  const diff = d.startOf('day').diff(today.startOf('day'), 'day');
  if (diff > 1 && diff < 7) return DAYS_FR[d.day()];
  return `${DAYS_FR[d.day()]} ${d.date()} ${MONTHS_FR[d.month()]}`;
}

export function buildTimelineItems({ ops = [], sortDir = 'desc', now = dayjs() } = {}) {
  const today = dayjs(now).startOf('day');
  const dir = sortDir === 'asc' ? 1 : -1;

  // Tri : par date desc, puis non pointées avant pointées à date égale.
  const sorted = [...ops].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    const d = (da - db) * dir;
    if (d !== 0) return d;
    return (a.pointed === b.pointed) ? 0 : (a.pointed ? 1 : -1);
  });

  const items = [];
  let lastDay = null;
  let sectionInserted = false; // évite de doubler le séparateur « À VENIR »

  for (const op of sorted) {
    if (!op.date) continue;
    const d = dayjs(op.date).startOf('day');
    const dayKey = d.format('YYYY-MM-DD');
    const isFuture = d.isAfter(today, 'day');

    // Séparateur « À VENIR » : avant le premier jour futur en mode desc,
    // ou avant le premier jour futur en asc également (même position
    // visuelle relative au jour today).
    if (sortDir === 'desc' && isFuture && !sectionInserted) {
      items.push({ type: 'section', label: 'À venir' });
      sectionInserted = true;
    }
    if (sortDir === 'asc' && isFuture && !sectionInserted) {
      // En asc, les futures viennent après les passées : on insère le
      // séparateur avant la première date future, hors début de liste.
      items.push({ type: 'section', label: 'À venir' });
      sectionInserted = true;
    }

    if (dayKey !== lastDay) {
      items.push({ type: 'day', date: dayKey, label: formatDayLabel(d, today) });
      lastDay = dayKey;
    }
    items.push({ type: 'op', op });
  }
  return items;
}
