import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatEur = (v) =>
  v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '';

// Montant avec signe explicite : « +12,00 € » pour un positif, sinon le format
// standard (les négatifs portent déjà leur « - »). Le 0 reste sans préfixe.
export const formatSignedEur = (v) => (v > 0 ? `+${formatEur(v)}` : formatEur(v));

// Couleur sémantique d'un montant : crédit (>= 0) ou débit. Les tokens
// --credit / --debit ont leurs variantes dark définies dans index.css.
export const amountClass = (value) => (value >= 0 ? 'text-credit' : 'text-debit');
