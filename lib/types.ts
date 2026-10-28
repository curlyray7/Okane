export type CategoryKind = "fixed" | "envelope";

export interface Income {
  id: string;
  name: string;
  amount: number;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  budget: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  /** Échéance au format YYYY-MM */
  deadline: string;
}

export interface Expense {
  id: string;
  /** Date au format YYYY-MM-DD */
  date: string;
  amount: number;
  categoryId: string;
  label: string;
  createdAt: number;
}

export interface MonthData {
  expenses: Expense[];
  /** Montant d'épargne mensuelle confirmé comme versé (0 = pas encore) */
  savingsDone: number;
  /** Épargne bonus issue du non-dépensé */
  bonus: number;
}

export interface AppData {
  version: 1;
  createdAt: string;
  /** Premier mois suivi, YYYY-MM */
  startMonth: string;
  incomes: Income[];
  categories: Category[];
  goals: Goal[];
  savingsMonthly: number;
  margin: number;
  initialSavings: number;
  months: Record<string, MonthData>;
}
