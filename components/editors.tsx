"use client";

import { MoneyInput, TextInput } from "./ui";
import { uid } from "@/lib/format";

export interface Row {
  id: string;
  name: string;
  amount: string;
  /** Enveloppes seulement : garder le reste le mois suivant */
  rollover?: boolean;
}
export interface GoalRow {
  id: string;
  name: string;
  target: string;
  deadline: string;
}

export const newRow = (): Row => ({ id: uid(), name: "", amount: "" });

/** « Je reçois ma paie le [26] du mois » : découpe le budget du jour de paie à la veille du suivant. */
export function PaydayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-4 flex flex-wrap items-center gap-2 text-[0.95rem]">
      Je reçois ma paie le
      <TextInput
        aria-label="Jour de paie"
        inputMode="numeric"
        placeholder="1"
        maxLength={2}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="!w-16 text-center"
      />
      du mois
      <small className="block w-full text-[0.8rem] text-ink-2">Ton budget ira du jour de paie à la veille de la suivante (ex. du 26 au 25). Laisse vide si c’est le 1er.</small>
    </label>
  );
}
export const newGoalRow = (): GoalRow => ({ id: uid(), name: "", target: "", deadline: "" });

export function RowsEditor({
  rows,
  onChange,
  namePlaceholder,
  addLabel,
  rollover = false,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  namePlaceholder: string;
  addLabel: string;
  /** Affiche l’option « garder le reste » (enveloppes) */
  rollover?: boolean;
}) {
  const set = (id: string, patch: Partial<Row>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.id} className={`grid grid-cols-[1fr_120px_36px] items-center gap-x-2 ${rollover ? "gap-y-1" : ""}`}>
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
          {rollover && (
            <label className="col-span-3 flex items-center gap-2 pl-1 text-[0.8rem] text-ink-2">
              <input type="checkbox" checked={!!r.rollover} onChange={(e) => set(r.id, { rollover: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
              Garder le reste le mois suivant (cadeaux, vêtements, vacances…)
            </label>
          )}
        </div>
      ))}
      <button type="button" className="mt-1 rounded-xl border-2 border-dashed border-accent px-4 py-2.5 text-sm font-semibold text-accent" onClick={() => onChange([...rows, newRow()])}>
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
        <div key={r.id} className="rounded-2xl border-2 border-ink p-3">
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
      <button type="button" className="rounded-xl border-2 border-dashed border-accent px-4 py-2.5 text-sm font-semibold text-accent" onClick={() => onChange([...rows, newGoalRow()])}>
        + Ajouter un objectif
      </button>
    </div>
  );
}
