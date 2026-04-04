/** Utilisateur authentifié. */
export interface User {
  _id: string;
  username: string;
}

/** Compte bancaire appartenant à un utilisateur. */
export interface Bank {
  _id: string;
  label: string;
  userId: string;
}

/**
 * Période comptable mensuelle.
 * `balances` : solde de départ par bankId pour ce mois.
 */
export interface Period {
  _id: string;
  month: number;                       // 1–12
  year: number;
  balances: Record<string, number>;    // { [bankId]: solde initial }
  userId: string;
}

/**
 * Opération financière rattachée à une période et une banque.
 * `amount` négatif = débit, positif = crédit.
 * `pointed` = rapprochée (visuellement atténuée).
 * `bankId` peut être un objet populé (API) ou un string (SQLite).
 */
export interface Operation {
  _id: string;
  label: string;
  amount: number;
  date: string;       // ISO 8601
  pointed: boolean;
  bankId: string | Bank;
  periodId: string;
  userId: string;
}

/**
 * Modèle de saisie récurrente importable chaque mois.
 * `dayOfMonth` : jour d'échéance (1–31, clampé au dernier jour du mois si besoin).
 */
export interface RecurringOperation {
  _id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  bankId: string | Bank;
  userId: string;
}

/** Identifiants de connexion / inscription. */
export interface AuthCredentials {
  username: string;
  password: string;
}

export type BankBalance = { bankId: string; value: number };
