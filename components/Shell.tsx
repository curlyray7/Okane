"use client";

import { useEffect, useState } from "react";
import type { AppData } from "@/lib/types";
import { addMonths, monthKey, monthLabel } from "@/lib/format";
import { Home } from "./Home";
import { Expenses } from "./Expenses";
import { Review } from "./Review";
import { Settings } from "./Settings";
import { ExpenseSheet } from "./ExpenseSheet";
import { ImportSheet } from "./ImportSheet";

const TABS = [
  { id: "accueil", label: "Accueil", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { id: "depenses", label: "Dépenses", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "bilan", label: "Bilan", icon: "M5 20V10M12 20V4M19 20v-7" },
  { id: "reglages", label: "Réglages", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Shell({ data }: { data: AppData }) {
  const [tab, setTab] = useState<Tab>("accueil");
  const [month, setMonth] = useState(monthKey());
  const [sheet, setSheet] = useState<{ open: boolean; id?: string }>({ open: false });
  const [fabHidden, setFabHidden] = useState(false);

  // Le bouton + s’efface quand on descend (pour ne pas cacher les montants) et revient quand on remonte.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setFabHidden(y > last && y > 80);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as Tab);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  };
  const canPrev = month > data.startMonth;

  return (
    <>
      <div className="mx-auto max-w-[1040px] px-4 pt-4 pb-40">
        {tab !== "reglages" && (
          <header className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <MonthBtn label="Mois précédent" disabled={!canPrev} onClick={() => setMonth(addMonths(month, -1))}>‹</MonthBtn>
              <h1 className="min-w-[9ch] text-center font-manga text-[2rem] leading-none capitalize">{monthLabel(month)}</h1>
              <MonthBtn label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}>›</MonthBtn>
            </div>
            {month !== monthKey() && (
              <button type="button" className="text-sm font-semibold text-accent" onClick={() => setMonth(monthKey())}>
                Aujourd’hui
              </button>
            )}
          </header>
        )}
        {tab === "accueil" && <Home data={data} month={month} />}
        {tab === "depenses" && <Expenses data={data} month={month} onEdit={(id) => setSheet({ open: true, id })} onAdd={() => setSheet({ open: true })} onImport={() => setImporting(true)} />}
        {tab === "bilan" && <Review data={data} month={month} />}
        {tab === "reglages" && <Settings data={data} />}
      </div>

      {tab !== "reglages" && (
        <button
          type="button"
          aria-label="Ajouter une dépense"
          onClick={() => setSheet({ open: true })}
          className="fixed z-20 grid h-[62px] w-[62px] place-items-center rounded-full border-[3px] border-ink bg-pop text-[2.2rem] leading-none font-medium text-on-pop shadow-ink transition-[transform,opacity] duration-200 active:scale-95 min-[1080px]:right-[calc(50%-520px+18px)]"
          style={{
            right: 18,
            bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
            transform: fabHidden ? "translateY(140%)" : undefined,
            opacity: fabHidden ? 0 : 1,
          }}
          tabIndex={fabHidden ? -1 : 0}
        >
          +
        </button>
      )}

      <nav
        aria-label="Navigation"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center border-t-2 border-ink bg-surface px-2 pt-1.5"
        style={{ paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex w-full max-w-[520px] gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => go(t.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[0.8rem] font-semibold ${tab === t.id ? "border-2 border-ink bg-accent text-on-accent shadow-ink-sm" : "border-2 border-transparent text-ink-2"}`}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {importing && <ImportSheet data={data} onClose={() => setImporting(false)} />}
      {sheet.open && <ExpenseSheet data={data} month={month} expenseId={sheet.id} onClose={() => setSheet({ open: false })} />}
    </>
  );
}

function MonthBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-surface text-lg shadow-ink-sm disabled:opacity-30 disabled:shadow-none">
      {children}
    </button>
  );
}
