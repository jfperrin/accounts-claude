import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatEur = (v) =>
  v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) ?? '';
