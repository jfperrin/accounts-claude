// Helpers de parsing partagés entre parseQif et parseOfx :
//   - parseDate    : DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
//   - parseAmount  : auto-détection FR / US (point ou virgule décimal)

// Parse une date au format DD/MM/YYYY, DD-MM-YYYY ou YYYY-MM-DD.
// Retourne un Date (UTC à minuit) ou null si non reconnu.
function parseDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  // ISO YYYY-MM-DD (ou plus, ex. avec heure)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // FR DD/MM/YYYY ou DD-MM-YYYY (année 2 ou 4 chiffres)
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const d = new Date(Date.UTC(year, +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Parse un montant : auto-détecte le séparateur décimal (FR ou US/EN).
//   "1 234,56"   → 1234.56  (FR : virgule décimale, espace millier)
//   "1.234,56"   → 1234.56  (FR/DE : virgule décimale, point millier)
//   "1,234.56"   → 1234.56  (US : point décimal, virgule millier)
//   "-12.34"     → -12.34
//   "234,56"     → 234.56
//   ""           → null
//
// Heuristique : si "." et "," coexistent, le DERNIER rencontré est le décimal
// (l'autre est un séparateur de milliers et peut être supprimé).
function parseAmount(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const cleaned = s.replace(/\s/g, '');
  let normalized;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  if (lastDot === -1 && lastComma === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

module.exports = { parseDate, parseAmount };
