"use client";

import { useState } from "react";
import { setData } from "@/lib/store";
import { eur, eur0, round2 } from "@/lib/format";
import { Alert, Button, LifeBar, MoneyInput } from "./ui";
import { GoalsEditor, PaydayField, RowsEditor, newGoalRow } from "./editors";
import { currentPeriod, paydayOf } from "@/lib/period";
import { Draft, draftToData, draftTotals, emptyDraft, validateDraft } from "./draft";
import { Mascot, MascotSays } from "./Mascot";

const STEPS = ["welcome", "incomes", "fixed", "envelopes", "savings", "goals", "recap"] as const;
type Step = (typeof STEPS)[number];

export function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const idx = STEPS.indexOf(step);
  const totals = draftTotals(draft);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const next = () => {
    const scope = step === "welcome" || step === "recap" ? undefined : step;
    const errs = scope ? validateDraft(draft, scope) : [];
    setErrors(errs);
    if (errs.length) return;
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    setErrors([]);
    setStep(STEPS[Math.max(idx - 1, 0)]);
  };
  const finish = () => {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (errs.length) return;
    // Le budget créé, on arrive sur l’accueil (l’adresse pouvait garder #reglages après un effacement).
    history.replaceState(null, "", "#accueil");
    window.scrollTo({ top: 0 });
    setData({
      version: 1,
      createdAt: new Date().toISOString(),
      startMonth: currentPeriod(paydayOf(draftToData(draft))),
      months: {},
      ...draftToData(draft),
    });
  };

  const precaution = round2(3 * (totals.fixed + totals.envelopes));

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-16">
      {step !== "welcome" && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-ink-2">
            <button type="button" onClick={back} className="font-semibold">‹ Retour</button>
            <span className="font-semibold text-accent">
              Niveau {idx} sur {STEPS.length - 1}
            </span>
          </div>
          <div className="px-1">
            <LifeBar left={idx} total={STEPS.length - 1} state="ok" fromLeft />
          </div>
        </div>
      )}

      {step === "welcome" && (
        <div className="pt-8">
          <Logo />
          <Hero />
          <p className="mt-8 max-w-md text-lg text-ink-2">
            Chaque euro reçoit sa mission (charges, enveloppes, épargne), puis tu vois en un coup d’œil ce qu’il te
            reste. Prêt pour l’entraînement ?
          </p>
          <ul className="mt-6 space-y-2 text-[0.95rem]">
            <li>Cinq minutes pour créer ton budget.</li>
            <li>Aucun compte, aucune connexion bancaire.</li>
            <li>Tes données restent sur cet appareil.</li>
          </ul>
          <Button variant="accent" className="mt-8 w-full py-3.5 text-lg" onClick={next}>
            Yosh, on commence !
          </Button>
        </div>
      )}

      {step === "incomes" && (
        <StepFrame title="Ce que tu gagnes chaque mois" hint="Salaire net, aides, pension… Uniquement ce qui revient tous les mois.">
          <RowsEditor rows={draft.incomes} onChange={(incomes) => patch({ incomes })} namePlaceholder="ex. Salaire" addLabel="Ajouter un revenu" />
          <PaydayField value={draft.payday} onChange={(payday) => patch({ payday })} />
          <Total label="Total des revenus" value={totals.income} />
        </StepFrame>
      )}

      {step === "fixed" && (
        <StepFrame title="Tes charges fixes" hint="Ce qui est prélevé tous les mois sans que tu y penses : loyer, téléphone, assurance, abonnements…">
          <RowsEditor rows={draft.fixed} onChange={(fixed) => patch({ fixed })} namePlaceholder="ex. Loyer" addLabel="Ajouter une charge" />
          <Remaining value={round2(totals.income - totals.fixed)} />
        </StepFrame>
      )}

      {step === "envelopes" && (
        <StepFrame title="Tes enveloppes de dépenses" hint="Les dépenses qui varient : courses, sorties, vêtements… Fixe un montant par mois pour chacune.">
          <RowsEditor rows={draft.envelopes} onChange={(envelopes) => patch({ envelopes })} namePlaceholder="ex. Courses" addLabel="Ajouter une enveloppe" rollover />
          <Remaining value={round2(totals.income - totals.fixed - totals.envelopes)} />
        </StepFrame>
      )}

      {step === "savings" && (
        <StepFrame title="Ton épargne" hint="Ce qui reste après les charges et les enveloppes peut devenir de l’épargne.">
          <Field label="Épargne mensuelle" hint="Le montant que tu mets de côté chaque mois.">
            <MoneyInput value={draft.savingsMonthly} placeholder="0" onChange={(savingsMonthly) => patch({ savingsMonthly })} />
          </Field>
          <Field label="Marge de sécurité" hint="Laissée sur ton compte courant pour éviter le découvert. Facultatif.">
            <MoneyInput value={draft.margin} placeholder="0" onChange={(margin) => patch({ margin })} />
          </Field>
          <Field label="Épargne actuelle" hint="Ce que tu as déjà de côté aujourd’hui. Facultatif.">
            <MoneyInput value={draft.initialSavings} placeholder="0" onChange={(initialSavings) => patch({ initialSavings })} />
          </Field>
          <Remaining value={totals.toAllocate} final />
        </StepFrame>
      )}

      {step === "goals" && (
        <StepFrame title="Tes objectifs d’épargne" hint="Facultatif. Ton épargne remplit tes objectifs dans l’ordre de priorité.">
          {draft.goals.length === 0 && precaution > 0 && (
            <div className="mb-6 rounded-2xl bg-surface-2 p-4 text-[0.95rem]">
              <p>
                Un conseil : commence par une <b>épargne de précaution</b> de 3 mois de dépenses, soit {eur0(precaution)} avec ton
                budget.
              </p>
              <Button
                variant="ghost"
                className="mt-3"
                onClick={() => patch({ goals: [{ ...newGoalRow(), name: "Épargne de précaution", target: String(precaution).replace(".", ",") }] })}
              >
                Ajouter cet objectif
              </Button>
            </div>
          )}
          <GoalsEditor rows={draft.goals} onChange={(goals) => patch({ goals })} />
        </StepFrame>
      )}

      {step === "recap" && (
        <StepFrame title="Ton budget mensuel" hint="Vérifie, puis lance-toi. Tout reste modifiable dans les réglages." plain>
          <div className="rounded-2xl bg-surface-2 px-4 py-3">
            <Line label="Revenus" value={totals.income} />
            <Line label="Charges fixes" value={-totals.fixed} />
            <Line label="Enveloppes" value={-totals.envelopes} />
            <Line label="Épargne" value={-totals.savings} />
            {totals.margin > 0 && <Line label="Marge de sécurité" value={-totals.margin} />}
            <div className="mt-2 flex justify-between border-t border-line pt-3 font-semibold">
              <span>Reste à répartir</span>
              <span className="tabular">{eur(totals.toAllocate)}</span>
            </div>
          </div>
          <div className="mt-4">
            {Math.abs(totals.toAllocate) < 0.01 ? (
              <MascotSays mood="fierte">Chaque euro a sa mission. Sugoi, ton budget est prêt !</MascotSays>
            ) : (
              <AllocateAlert
                value={totals.toAllocate}
                onSave={() => patch({ savingsMonthly: String(round2(totals.savings + totals.toAllocate)).replace(".", ",") })}
                onAdjust={() => setStep(totals.toAllocate > 0 ? "envelopes" : "savings")}
              />
            )}
          </div>
          {totals.income > 0 && totals.savings / totals.income < 0.05 && (
            <div className="mt-3">
              <Alert tone="warn">Ton épargne représente moins de 5 % de tes revenus. Même 20 € par mois créent une habitude.</Alert>
            </div>
          )}
        </StepFrame>
      )}

      {errors.length > 0 && (
        <div className="mt-4">
          <Alert tone="bad">
            <ul className="list-disc pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}

      {step !== "welcome" && (
        <div className="mt-8">
          {step === "recap" ? (
            <Button variant="accent" className="w-full py-3.5 text-lg" onClick={finish}>
              C’est parti !
            </Button>
          ) : (
            <Button variant="accent" className="w-full py-3.5 text-lg" onClick={next}>
              {step === "goals" && draft.goals.length === 0 ? "Passer cette étape" : "Continuer"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={42} height={42} className="h-[42px] w-[42px] rounded-xl" />
      <span className="font-manga text-3xl">Okane</span>
    </div>
  );
}

/** Case de manga d’accueil, la même que sur l’accueil de l’app : le titre dedans, la mascotte qui sort du cadre. */
function Hero() {
  return (
    <div className="relative mt-10 mr-1">
      <div className="speed-lines overflow-hidden rounded-[6px] border-[3px] border-ink bg-hero px-5 pt-6 pb-6 text-on-hero shadow-ink">
        <h1 className="relative z-[1] max-w-[62%] font-manga text-[clamp(2.6rem,11vw,3.4rem)] leading-[0.92] [text-shadow:3px_3px_0_var(--accent)]">
          Ton argent, ton plan.
        </h1>
      </div>
      <div className="sticker pointer-events-none absolute -top-8 -right-2 z-[2]">
        <Mascot mood="victoire" size={160} />
      </div>
    </div>
  );
}

/** `plain` : consigne sans mascotte, quand l’étape a déjà la sienne (le récap). */
function StepFrame({ title, hint, plain, children }: { title: string; hint: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-manga text-[2.3rem] leading-none">{title}</h1>
      {plain ? (
        <p className="mt-2 mb-6 text-ink-2">{hint}</p>
      ) : (
        // La mascotte donne la consigne de l’étape, en pointant vers sa bulle.
        <div className="mt-3 mb-6">
          <MascotSays mood="explique" size={72}>
            {hint}
          </MascotSays>
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 grid grid-cols-[1fr_140px] items-center gap-3 border-b border-line pb-4">
      <span>
        {label}
        <small className="block text-[0.8rem] text-ink-2">{hint}</small>
      </span>
      {children}
    </label>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="mt-6 flex justify-between rounded-xl bg-surface-2 px-4 py-3">
      <span>{label}</span>
      <b className="tabular">{eur(value)}</b>
    </div>
  );
}

function Remaining({ value, final }: { value: number; final?: boolean }) {
  return (
    <div className={`mt-6 flex justify-between rounded-xl px-4 py-3 ${value < 0 ? "bg-over-soft text-over" : "bg-surface-2"}`}>
      <span>{final ? "Reste à répartir" : "Il reste"}</span>
      <b className="tabular">{eur(value)}</b>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-ink-2">{label}</span>
      <span className="tabular">{value < 0 ? `− ${eur(-value)}` : eur(value)}</span>
    </div>
  );
}

/** « Reste à répartir » : avec un bouton pour verser le reste en épargne et un autre pour ajuster les montants. */
export function AllocateAlert({ value, onSave, onAdjust }: { value: number; onSave?: () => void; onAdjust?: () => void }) {
  if (Math.abs(value) < 0.01) return <Alert tone="ok">Chaque euro a sa mission. Sugoi !</Alert>;
  const adjust = onAdjust && (
    <Button variant="ghost" onClick={onAdjust}>
      {value > 0 ? "Répartir dans mes enveloppes" : "Ajuster mes montants"}
    </Button>
  );
  if (value > 0)
    return (
      <Alert
        tone="warn"
        action={
          (onSave || adjust) && (
            <div className="flex flex-wrap gap-2">
              {onSave && (
                <Button variant="save" onClick={onSave}>
                  Mettre {eur(value)} en épargne
                </Button>
              )}
              {adjust}
            </div>
          )
        }
      >
        {eur(value)} n’ont pas encore de mission. Ajoute-les à ton épargne ou à une enveloppe, pas d’euro sans mission.
      </Alert>
    );
  return (
    <Alert tone="bad" action={adjust}>
      Tu prévois {eur(-value)} de plus que ce que tu gagnes. Réduis une enveloppe ou ton épargne.
    </Alert>
  );
}
