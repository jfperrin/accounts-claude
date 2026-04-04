export interface User {
  _id: string;
  username: string;
}

export interface Bank {
  _id: string;
  label: string;
  userId: string;
}

export interface Period {
  _id: string;
  month: number;
  year: number;
  balances: Record<string, number>;
  userId: string;
}

export interface Operation {
  _id: string;
  label: string;
  amount: number;
  date: string;
  pointed: boolean;
  bankId: string | Bank;
  periodId: string;
  userId: string;
}

export interface RecurringOperation {
  _id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  bankId: string | Bank;
  userId: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export type BankBalance = { bankId: string; value: number };
