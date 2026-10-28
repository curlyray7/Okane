"use client";

import { MoneyInput, TextInput } from "./ui";
import { uid } from "@/lib/format";

export interface Row {
  id: string;
  name: string;
  amount: string;
}
export interface GoalRow {
  id: string;
  name: string;
  target: string;
  deadline: string;
}

export const newRow = (): Row => ({ id: uid(), name: "", amount: "" });
export const newGoalRow = (): GoalRow => ({ id: uid(), name: "", target: "", deadline: "" });

export function RowsEditor({
  rows,
  onChange,
  namePlaceholder,
  addLabel,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  namePlaceholder: string;
  addLabel: string;
}) {
  const set = (id: string, patch: Partial<Row>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id} className="grid grid-cols-[1fr_120px_36px] items-center gap-2">
          <TextInput
            aria-label={`Nom, ligne ${i + 1}`}
            placeholder={namePlaceholder}
            value={r.name}
            maxLength={40}
            onChange={(e) => set(r.id, { name: e.target.value })}
          />
          <MoneyInput aria-label={`Montant, ligne ${i + 1}`} placeholder="0" value={r.amount} onChange={(v) => set(r.id, { amount: v })} />
          <button
            type="button"
            aria-label={`Supprimer la ligne ${i + 1}`}
            className="h-9 w-9 rounded-full text-ink-2 hover:bg-surface-2"
            onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="mt-1 rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-semibold text-ink-2" onClick={() => onChange([...rows, newRow()])}>
        + {addLabel}
      </button>
    </div>
  );
}

export function GoalsEditor({ rows, onChange }: { rows: GoalRow[]; onChange: (rows: GoalRow[]) => void }) {
  const set = (id: string, patch: Partial<GoalRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-2xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between text-sm text-ink-2">
            <span>Priorité {i + 1}</span>
            <span className="flex gap-1">
              <button type="button" aria-label="Monter" className="h-8 w-8 rounded-full hover:bg-surface-2 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="Descendre" className="h-8 w-8 rounded-full hover:bg-surface-2 disabled:opacity-30" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label="Supprimer l’objectif" className="h-8 w-8 rounded-full hover:bg-surface-2" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}>✕</button>
            </span>
          </div>
          <TextInput placeholder="Nom de l’objectif (ex. voyage, permis, matelas de sécurité)" value={r.name} maxLength={40} onChange={(e) => set(r.id, { name: e.target.value })} aria-label="Nom de l’objectif" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-sm text-ink-2">
              Montant visé
              <MoneyInput value={r.target} placeholder="0" onChange={(v) => set(r.id, { target: v })} />
            </label>
            <label className="text-sm text-ink-2">
              Échéance
              <TextInput type="month" value={r.deadline} onChange={(e) => set(r.id, { deadline: e.target.value })} />
            </label>
          </div>
        </div>
      ))}
      <button type="button" className="rounded-xl border border-dashed border-line px-4 py-2.5 text-sm font-semibold text-ink-2" onClick={() => onChange([...rows, newGoalRow()])}>
        + Ajouter un objectif
      </button>
    </div>
  );
}
