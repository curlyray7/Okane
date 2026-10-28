"use client";

import { SAVINGS, type AppData } from "@/lib/types";
import { categoryName, colorFor, getMonth, sumBy } from "@/lib/calc";
import { dayLabel, eur } from "@/lib/format";
import { inPeriod, paydayOf } from "@/lib/period";
import { Button, Panel } from "./ui";

interface Line {
  id: string;
  date: string;
  createdAt: number;
  label: string;
  amount: number;
  cat: string;
  extra: boolean;
  imported: boolean;
}

const where = (data: AppData, cat: string) => (cat === SAVINGS ? "Épargne" : categoryName(data, cat));

export function Expenses({ data, month, onEdit, onAdd, onImport }: { data: AppData; month: string; onEdit: (id: string) => void; onAdd: () => void; onImport: () => void }) {
  const m = getMonth(data, month);
  // Dépenses, remboursements (montant négatif) et rentrées en plus, dans une seule liste.
  const list: Line[] = [
    ...m.expenses.map((e) => ({ id: e.id, date: e.date, createdAt: e.createdAt, label: e.label, amount: e.amount, cat: e.categoryId, extra: false, imported: !!e.importId })),
    ...(m.extras ?? []).map((x) => ({ id: x.id, date: x.date, createdAt: x.createdAt, label: x.label, amount: x.amount, cat: x.target, extra: true, imported: !!x.importId })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const spent = sumBy(m.expenses, (e) => Math.max(0, e.amount));
  const refunded = sumBy(m.expenses, (e) => Math.max(0, -e.amount));
  const extras = sumBy(m.extras ?? [], (x) => x.amount);

  if (list.length === 0)
    return (
      <Panel className="py-10 text-center">
        <p className="text-ink-2">Aucune opération {inPeriod(month, paydayOf(data))}.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Button variant="accent" onClick={onAdd}>
            Ajouter une dépense
          </Button>
          <Button variant="ghost" onClick={onImport}>
            Importer un relevé
          </Button>
        </div>
      </Panel>
    );

  const byDay = new Map<string, Line[]>();
  for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="mx-auto max-w-[640px]">
      <Panel className="mb-4">
        <div className="flex justify-between">
          <span>Dépensé {paydayOf(data) > 1 ? "sur la période" : "ce mois"}</span>
          <b className="font-display tabular">{eur(spent)}</b>
        </div>
        {refunded > 0 && (
          <div className="mt-1 flex justify-between text-save">
            <span>Remboursements</span>
            <b className="font-display tabular">+{eur(refunded)}</b>
          </div>
        )}
        {extras > 0 && (
          <div className="mt-1 flex justify-between text-save">
            <span>Rentrées en plus</span>
            <b className="font-display tabular">+{eur(extras)}</b>
          </div>
        )}
        <Button variant="ghost" className="mt-3 w-full" onClick={onImport}>
          Importer un relevé bancaire
        </Button>
      </Panel>
      {[...byDay.entries()].map(([day, items]) => (
        <div key={day} className="mb-4">
          <h3 className="mb-1.5 font-manga text-lg text-accent first-letter:uppercase">{dayLabel(day)}</h3>
          {items.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onEdit(e.id)}
              className="mb-2 flex w-full items-center gap-3 rounded-xl border-2 border-ink bg-surface px-3 py-2.5 text-left shadow-ink-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <i className="inline-block h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: e.cat === SAVINGS ? "var(--save)" : colorFor(data, e.cat) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.label || where(data, e.cat)}</span>
                {/* Sans libellé, le nom de l’enveloppe est déjà le titre : on ne le répète pas. */}
                {(e.label || e.extra || e.amount < 0 || e.imported) && (
                  <small className="block text-[0.8rem] text-ink-2">
                    {[e.extra ? "En plus" : e.amount < 0 ? "Remboursement" : "", e.label ? where(data, e.cat) : "", e.imported ? "relevé" : ""].filter(Boolean).join(" · ")}
                  </small>
                )}
              </span>
              <span className={`font-display font-semibold tabular ${e.extra || e.amount < 0 ? "text-save" : ""}`}>
                {e.extra || e.amount < 0 ? `+${eur(Math.abs(e.amount))}` : eur(e.amount)}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
