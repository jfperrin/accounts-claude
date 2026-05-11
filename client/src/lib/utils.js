import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatEur = (v) =>
  v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '';

// Couleur sémantique d'un montant : crédit (>= 0) ou débit. Les tokens
// --credit / --debit ont leurs variantes dark définies dans index.css.
export const amountClass = (value) => (value >= 0 ? 'text-credit' : 'text-debit');
