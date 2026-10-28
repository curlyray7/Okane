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
  /** Identifiant de la ligne de relevé importée, pour ne pas l'importer deux fois */
  importId?: string;
}

export interface MonthData {
  expenses: Expense[];
  /** Montant d'épargne mensuelle confirmé comme versé (0 = pas encore) */
  savingsDone: number;
  /** Épargne bonus issue du non-dépensé */
  bonus: number;
}

/** Règle de classement des relevés : un mot-clé du libellé → une enveloppe, ou « ignore » */
export interface ImportRule {
  id: string;
  pattern: string;
  target: string;
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
  rules?: ImportRule[];
  /** Lignes de relevé déjà écartées à l'import, pour ne pas les reproposer */
  ignoredImports?: string[];
}
