const { createHash } = require('crypto');

// Forme canonique pour le hash : tri par (date, _id), join '|', séparé par '\n'.
// L'inclusion du label garantit qu'un rename de récurrente invalide le cache,
// même si date/amount/categoryId restent identiques.
function canonicalOps(ops) {
  const sorted = [...ops].sort((a, b) => {
    const cmp = String(a.date).localeCompare(String(b.date));
    if (cmp !== 0) return cmp;
    return String(a._id ?? '').localeCompare(String(b._id ?? ''));
  });
  return sorted
    .map((o) => [
      o.date,
      Number(o.amount).toFixed(2),
      o.categoryId ?? '-',
      o.label ?? '',
    ].join('|'))
    .join('\n');
}

function digestOps(ops) {
  return createHash('sha256').update(canonicalOps(ops)).digest('hex');
}

module.exports = { canonicalOps, digestOps };
