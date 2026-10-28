"use client";

import type { AppData, Expense } from "@/lib/types";
import { categoryName, colorFor, getMonth, sumBy } from "@/lib/calc";
import { dayLabel, eur, monthLabel } from "@/lib/format";
import { Button, Panel } from "./ui";

export function Expenses({ data, month, onEdit, onAdd, onImport }: { data: AppData; month: string; onEdit: (id: string) => void; onAdd: () => void; onImport: () => void }) {
  const list = getMonth(data, month)
    .expenses.slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  if (list.length === 0)
    return (
      <Panel className="py-10 text-center">
        <p className="text-ink-2">Aucune dépense en {monthLabel(month)}.</p>
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

  const byDay = new Map<string, Expense[]>();
  for (const e of list) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="mx-auto max-w-[640px]">
      <Panel className="mb-4">
        <div className="flex justify-between">
          <span>
            {list.length} dépense{list.length > 1 ? "s" : ""}
          </span>
          <b className="font-display tabular">{eur(sumBy(list, (e) => e.amount))}</b>
        </div>
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
              <i className="inline-block h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: colorFor(data, e.categoryId) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{e.label || categoryName(data, e.categoryId)}</span>
                <small className="block text-[0.8rem] text-ink-2">
                  {categoryName(data, e.categoryId)}
                  {e.importId && " · relevé"}
                </small>
              </span>
              <span className="font-display font-semibold tabular">{eur(e.amount)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
