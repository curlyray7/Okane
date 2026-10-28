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
  /** Enveloppe cumulative : le non-dépensé (ou le dépassement) est reporté sur le mois suivant */
  rollover?: boolean;
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
  /** Négatif pour un remboursement : l'argent revient dans l'enveloppe */
  amount: number;
  categoryId: string;
  label: string;
  createdAt: number;
  /** Identifiant de la ligne de relevé importée, pour ne pas l'importer deux fois */
  importId?: string;
}

/** Rentrée d'argent imprévue (virement d'un parent, prime…) ajoutée au budget d'une enveloppe ou à l'épargne */
export interface Extra {
  id: string;
  date: string;
  amount: number;
  label: string;
  /** Identifiant d'enveloppe, ou SAVINGS */
  target: string;
  createdAt: number;
  importId?: string;
}

export const SAVINGS = "savings";

/** Argent déplacé d'une enveloppe à une autre, pour ce mois seulement */
export interface Move {
  id: string;
  from: string;
  to: string;
  amount: number;
  createdAt: number;
}

export interface MonthData {
  expenses: Expense[];
  /** Montant d'épargne mensuelle confirmé comme versé (0 = pas encore) */
  savingsDone: number;
  /** Épargne bonus issue du non-dépensé */
  bonus: number;
  extras?: Extra[];
  moves?: Move[];
}

/**
 * Règle de classement des relevés : un mot-clé du libellé → une enveloppe, ou « ignore ».
 * Pour les rentrées (`on: "credit"`), la cible est « refund:<enveloppe> », « extra:<enveloppe> », « extra:savings » ou « ignore ».
 */
export interface ImportRule {
  id: string;
  pattern: string;
  target: string;
  on?: "credit";
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
  /** Date ISO du dernier téléchargement de sauvegarde */
  lastBackupAt?: string;
}
