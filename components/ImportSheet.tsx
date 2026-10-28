"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppData } from "@/lib/types";
import { colorFor, envelopeCats } from "@/lib/calc";
import { dayLabel, eur, isoDate, uid } from "@/lib/format";
import { updateData } from "@/lib/store";
import { BankLine, IGNORE, Reason, alreadyImported, keywordFor, learnRule, placesIn, prettyLabel, readStatement, suggest } from "@/lib/bankImport";
import { Alert, Button, useToast } from "./ui";
import { MascotSays } from "./Mascot";

interface Row extends BankLine {
  target: string;
  suggested: string;
  reason: Reason;
}

const REASON: Record<Reason, string> = {
  rule: "Règle apprise",
  fixed: "Charge fixe, déjà comptée",
  duplicate: "Déjà saisie à la main ?",
  none: "",
};

export function ImportSheet({ data, onClose }: { data: AppData; onClose: () => void }) {
  const toast = useToast();
  const envs = envelopeCats(data);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [info, setInfo] = useState({ credits: 0, known: 0 });
  const [error, setError] = useState("");
  const [learn, setLearn] = useState(true);
  const [filter, setFilter] = useState<"all" | "todo">("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    const res = await readStatement(file);
    if (res.error) return setError(res.error);
    const known = alreadyImported(data);
    const today = isoDate();
    const fresh = res.lines.filter((l) => !known.has(l.ref) && l.date <= today);
    const taken = new Set<string>();
    setInfo({ credits: res.credits, known: res.lines.length - fresh.length });
    setRows(
      fresh
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((l) => {
          const s = suggest(data, l, taken);
          return { ...l, target: s.target, suggested: s.target, reason: s.reason };
        }),
    );
  };

  const counts = useMemo(() => {
    const r = rows ?? [];
    return {
      toImport: r.filter((x) => x.target && x.target !== IGNORE).length,
      todo: r.filter((x) => !x.target).length,
      total: r.filter((x) => x.target && x.target !== IGNORE).reduce((s, x) => s + x.amount, 0),
    };
  }, [rows]);

  const setTarget = (ref: string, target: string) => setRows((rs) => rs?.map((r) => (r.ref === ref ? { ...r, target } : r)) ?? null);

  const confirm = () => {
    if (!rows) return;
    let firstMonth = "";
    const places = placesIn(rows.map((r) => r.label));
    const ok = updateData((d) => {
      d.rules ??= [];
      d.ignoredImports ??= [];
      for (const r of rows) {
        if (!r.target) continue;
        if (r.target === IGNORE) {
          d.ignoredImports.push(r.ref);
        } else {
          const key = r.date.slice(0, 7);
          const m = (d.months[key] ??= { expenses: [], savingsDone: 0, bonus: 0 });
          m.expenses.push({ id: uid(), date: r.date, amount: r.amount, categoryId: r.target, label: prettyLabel(r.label), createdAt: Date.now(), importId: r.ref });
          if (!firstMonth || key < firstMonth) firstMonth = key;
        }
        if (learn && r.target !== r.suggested && r.reason !== "duplicate") {
          // Un mot-clé court partagé par des lignes classées différemment (« UBER » : courses ou repas) devient plus précis,
          // tout comme une correction d’une règle existante, pour ne pas l’écraser.
          const short = keywordFor(r.label, places);
          const clash = r.reason === "rule" || rows.some((o) => o.target && o.target !== r.target && keywordFor(o.label, places) === short);
          learnRule(d.rules, clash ? keywordFor(r.label, places, true) : short, r.target, uid);
        }
      }
      d.ignoredImports = d.ignoredImports.slice(-3000);
      if (firstMonth && firstMonth < d.startMonth) d.startMonth = firstMonth;
    });
    if (!ok) return setError("Impossible d’enregistrer : le stockage du navigateur est plein ou bloqué.");
    toast(counts.toImport > 0 ? `${counts.toImport} dépense${counts.toImport > 1 ? "s" : ""} importée${counts.toImport > 1 ? "s" : ""}. Sugoi !` : "Relevé traité");
    onClose();
  };

  const shown = (rows ?? []).filter((r) => filter === "all" || !r.target);
  let lastDay = "";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/45 min-[600px]:items-center" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="flex max-h-[94vh] w-full max-w-[620px] flex-col rounded-t-[22px] border-2 border-b-0 border-ink bg-surface min-[600px]:rounded-[22px] min-[600px]:border-b-2 min-[600px]:shadow-ink"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between gap-3 px-[18px] pt-[18px] pb-3">
          <h2 id="import-title" className="font-manga text-[1.7rem] leading-none">
            Importer un relevé
          </h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink text-lg">
            ✕
          </button>
        </div>

        {!rows ? (
          <div className="overflow-auto px-[18px] pb-[18px]">
            <MascotSays mood="neutre">Exporte ton relevé depuis le site de ta banque, je range les dépenses dans tes enveloppes. Yosh !</MascotSays>
            <label
              className="mt-4 grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-accent-soft px-4 py-8 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                load(e.dataTransfer.files[0]);
              }}
            >
              <span className="font-manga text-2xl text-accent">Choisir un fichier</span>
              <span className="text-sm text-ink-2">CSV ou OFX · reste sur ton appareil, rien n’est envoyé</span>
              <input type="file" accept=".csv,.ofx,.qfx,.txt,text/csv" className="sr-only" onChange={(e) => load(e.target.files?.[0])} />
            </label>
            {error && (
              <div className="mt-4">
                <Alert tone="bad">{error}</Alert>
              </div>
            )}
            <details className="mt-4 text-sm text-ink-2">
              <summary className="cursor-pointer font-semibold text-ink">Où trouver mon relevé ?</summary>
              <p className="mt-2">
                Sur le site ou l’appli de ta banque, ouvre ton compte courant, puis cherche « Exporter », « Télécharger les opérations » ou
                « Relevé au format CSV / OFX / Money ». Choisis la période voulue. Les revenus et remboursements sont ignorés, seules les
                dépenses sont proposées.
              </p>
            </details>
          </div>
        ) : (
          <>
            <div className="px-[18px]">
              <p className="text-[0.93rem] text-ink-2">
                {rows.length} nouvelle{rows.length > 1 ? "s" : ""} dépense{rows.length > 1 ? "s" : ""}
                {info.known > 0 && ` · ${info.known} déjà traitée${info.known > 1 ? "s" : ""}`}
                {info.credits > 0 && ` · ${info.credits} crédit${info.credits > 1 ? "s" : ""} ignoré${info.credits > 1 ? "s" : ""}`}
              </p>
              {rows.length > 0 && (
                <div className="mt-3 flex gap-2" role="group" aria-label="Filtre">
                  {(
                    [
                      ["all", "Tout"],
                      ["todo", `À classer (${counts.todo})`],
                    ] as const
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={filter === k}
                      onClick={() => setFilter(k)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${filter === k ? "border-ink bg-accent text-on-accent shadow-ink-sm" : "border-line bg-surface-2"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto px-[18px]">
              {rows.length === 0 && <p className="py-8 text-center text-ink-2">Rien de nouveau dans ce relevé : tout est déjà importé.</p>}
              {shown.length === 0 && rows.length > 0 && <p className="py-8 text-center text-ink-2">Tout est classé. Sugoi !</p>}
              {shown.map((r) => {
                const head = r.date !== lastDay ? (lastDay = r.date) : null;
                return (
                  <div key={r.ref}>
                    {head && <h3 className="mt-2 mb-1.5 font-manga text-lg text-accent first-letter:uppercase">{dayLabel(head)}</h3>}
                    <div className={`mb-2 rounded-xl border-2 px-3 py-2.5 ${r.target ? "border-line" : "border-pop"}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate" title={r.label}>
                          {prettyLabel(r.label)}
                        </span>
                        <b className="font-display tabular whitespace-nowrap">{eur(r.amount)}</b>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <i
                          className="inline-block h-2.5 w-2.5 flex-none rounded-[3px]"
                          style={{ background: r.target && r.target !== IGNORE ? colorFor(data, r.target) : "transparent" }}
                        />
                        <select
                          aria-label={`Enveloppe pour ${r.label}`}
                          value={r.target}
                          onChange={(e) => setTarget(r.ref, e.target.value)}
                          className={`min-w-0 flex-1 rounded-[10px] border-2 bg-surface-2 px-2 py-1.5 text-[0.9rem] ${r.target ? "border-line" : "border-pop"} ${r.target === IGNORE ? "text-ink-2" : ""}`}
                        >
                          <option value="">À classer</option>
                          {envs.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          <option value={IGNORE}>Ignorer (charge fixe, virement…)</option>
                        </select>
                      </div>
                      {r.reason !== "none" && r.target === r.suggested && <p className="mt-1 text-[0.78rem] text-ink-2">{REASON[r.reason]}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t-2 border-ink px-[18px] pt-3 pb-[18px]">
              {error && (
                <div className="mb-3">
                  <Alert tone="bad">{error}</Alert>
                </div>
              )}
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                Retenir mes choix pour les prochains relevés
              </label>
              {counts.todo > 0 && (
                <p className="mb-2 text-[0.82rem] text-ink-2">
                  {counts.todo} ligne{counts.todo > 1 ? "s" : ""} à classer ne {counts.todo > 1 ? "seront" : "sera"} pas importée{counts.todo > 1 ? "s" : ""}.
                </p>
              )}
              <div className="flex gap-2.5">
                <Button variant="ghost" className="flex-1 py-3" onClick={() => setRows(null)}>
                  Autre fichier
                </Button>
                <Button variant="accent" className="flex-1 py-3" onClick={confirm} disabled={rows.length === 0}>
                  {counts.toImport > 0 ? `Importer ${eur(counts.total)}` : "Terminer"}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

