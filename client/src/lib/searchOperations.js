// Parse une saisie utilisateur du champ de recherche des opérations en
// libellé (texte) et éventuel montant. Un montant n'est reconnu que si
// le token contient un séparateur décimal (`,` ou `.`) — sans ça on
// confondrait un entier du libellé (« facture 2024 ») avec un filtre.
//
// Signe :
//   - préfixe `-` → strict débit (op.amount === -montant)
//   - préfixe `+` → strict crédit (op.amount === +montant)
//   - sans signe → comparaison sur la valeur absolue (les deux signes matchent)
//
// Le caractère € est ignoré. Un seul montant est extrait ; les tokens
// numériques supplémentaires retombent dans le libellé.
export function parseOperationSearch(input) {
  if (!input) return { label: '', amount: null, amountSign: null };
  const tokens = String(input).trim().split(/\s+/).filter(Boolean);
  const labelTokens = [];
  let amount = null;
  let amountSign = null;
  for (const t of tokens) {
    if (amount === null) {
      const cleaned = t.replace(/€/g, '');
      const m = cleaned.match(/^([-+]?)(\d*)[.,](\d+)$/);
      if (m) {
        const abs = parseFloat(`${m[2] || '0'}.${m[3]}`);
        if (Number.isFinite(abs)) {
          amount = abs;
          amountSign = m[1] === '-' ? 'neg' : m[1] === '+' ? 'pos' : null;
          continue;
        }
      }
    }
    labelTokens.push(t);
  }
  return { label: labelTokens.join(' '), amount, amountSign };
}

// Demi-centime : tolère les arrondis flottants tout en restant strict sur
// les montants à 2 décimales (1,99 ne matche pas 2,00).
const AMOUNT_EPSILON = 0.005;

export function matchesOperationAmount(op, amount, amountSign) {
  if (amount === null) return true;
  const v = Number(op?.amount);
  if (!Number.isFinite(v)) return false;
  if (amountSign === 'neg') return Math.abs(v + amount) < AMOUNT_EPSILON;
  if (amountSign === 'pos') return Math.abs(v - amount) < AMOUNT_EPSILON;
  return Math.abs(Math.abs(v) - amount) < AMOUNT_EPSILON;
}
