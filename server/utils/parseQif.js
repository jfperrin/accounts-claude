// Parser QIF (Quicken Interchange Format) pour relevés bancaires.
// Format texte plain, ligne-par-ligne avec un code 1-lettre en début de ligne :
//
//   !Type:Bank        ← en-tête de section (banque, carte, etc.) — ignoré ici
//   D04/25/2026       ← Date
//   T-210.00          ← Montant signé (négatif = débit)
//   PVIR INST WERO    ← Payee (libellé principal)
//   MMemo additionnel ← Memo (optionnel)
//   Cc                ← Cleared status (* ou X = pointé) — non lu
//   ^                 ← Fin de transaction
//   D04/24/2026
//   ...
//
// Avantages vs CSV : structure standardisée (pas de détection de colonnes),
// pas de problème de séparateur, encodage généralement ASCII / UTF-8.

const { parseDate, parseAmount } = require('./parseHelpers');

// Décodage du buffer : UTF-8 strict, fallback latin1 si invalide.
// Même logique que dans parseOfx — duplication assumée pour rester découplé.
function decodeBuffer(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (_) {
    return buf.toString('latin1');
  }
}

/**
 * Parse un buffer/string QIF en lignes d'opérations bancaires normalisées.
 *
 * Une opération est valide si elle a au moins date + montant + libellé.
 * Les lignes inconnues (codes non gérés : N, C, L, A, S, E…) sont ignorées
 * silencieusement — le parser reste tolérant.
 *
 * @param {Buffer|string} input
 * @returns {{ rows: Array<{ label, amount, date }>, invalid: number }}
 */
function parseBankQif(input) {
  let text = Buffer.isBuffer(input) ? decodeBuffer(input) : String(input);
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM UTF-8
  const lines = text.split(/\r?\n/);

  const rows = [];
  let invalid = 0;
  let current = null; // accumulateur de la transaction en cours

  // Pousse la transaction courante dans rows si valide, sinon incrémente invalid.
  // Réinitialise current pour la prochaine itération.
  const flush = () => {
    if (!current) return;
    if (current.date && current.label && current.amount != null && current.amount !== 0) {
      rows.push({ label: current.label, amount: current.amount, date: current.date });
    } else {
      invalid++;
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('!')) continue;       // section header (!Type:Bank, etc.)
    if (line === '^') { flush(); continue; }  // fin de transaction

    if (!current) current = {};
    const code = line[0];
    const value = line.slice(1).trim();

    switch (code) {
      case 'D': current.date = parseDate(value); break;
      case 'T': current.amount = parseAmount(value); break;
      // U : variante "amount" utilisée par certains exporteurs. On l'accepte
      // en backup si T n'a pas déjà fixé le montant.
      case 'U': if (current.amount == null) current.amount = parseAmount(value); break;
      case 'P': current.label = value; break;
      // Memo : utilisé comme libellé de fallback si Payee absent (rare mais existe).
      case 'M': if (!current.label) current.label = value; break;
      default: /* ignore N, C, L, A, S, E, $, % */ break;
    }
  }

  // Certains exporteurs oublient le ^ final → on flush quand même la dernière transaction.
  flush();

  return { rows, invalid };
}

module.exports = { parseBankQif };
