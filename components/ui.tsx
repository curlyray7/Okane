"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Variant = "primary" | "accent" | "save" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "border-2 border-ink bg-ink text-surface shadow-ink-sm",
  accent: "border-2 border-ink bg-accent text-on-accent shadow-ink-sm",
  save: "border-2 border-ink bg-save text-on-accent shadow-ink-sm",
  ghost: "border-2 border-ink text-ink bg-surface",
  danger: "border-2 border-over text-over bg-transparent",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`whitespace-nowrap rounded-xl px-4 py-2.5 font-semibold transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}

/**
 * Section posée sur le papier : un titre et son contenu, sans cadre (seule la case du haut de l’accueil est encadrée).
 * `soft` : léger fond, pour un conseil ou une note à part.
 */
export function Panel({
  title,
  children,
  className = "",
  action,
  id,
  soft = false,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  id?: string;
  soft?: boolean;
}) {
  return (
    <section id={id} className={`${soft ? "rounded-2xl bg-surface-2 p-4" : ""} ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-[1.12rem] leading-tight font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export type LifeState = "ok" | "fast" | "empty";

/** Barre de vie : pleine en début de période, elle se vide à mesure qu’on dépense. `marker` = part qui devrait encore rester aujourd’hui. */
export function LifeBar({ left, total, state, marker }: { left: number; total: number; state: LifeState; marker?: number }) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const color = state === "empty" ? "var(--over)" : state === "fast" ? "var(--gauge-warn)" : "var(--pop)";
  return (
    <div className={`life ${state === "empty" ? "!bg-over-soft" : ""}`} style={{ ["--life" as string]: color }}>
      <div className="life-fill" style={{ width: `${ratio * 100}%` }} />
      {marker !== undefined && marker > 0 && marker < 1 && (
        <div
          className="absolute -top-[5px] -bottom-[5px] z-[1] w-[3px] rounded-full bg-ink"
          style={{ left: `calc(${marker * 100}% - 1.5px)` }}
          title="Aujourd’hui : la barre devrait encore être au moins jusqu’ici"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** Jauge. `marker` (0 à 1) : repère « aujourd’hui », la part de la période déjà écoulée. */
export function Bar({ value, color, height = 12, marker }: { value: number; color: string; height?: number; marker?: number }) {
  return (
    <div className="relative">
      <div className="w-full overflow-hidden rounded-full border-2 border-ink bg-track" style={{ height }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
      </div>
      {marker !== undefined && marker > 0 && marker < 1 && (
        <div
          className="absolute -top-1 -bottom-1 w-[3px] -translate-x-1/2 rounded-full border border-surface bg-ink"
          style={{ left: `${marker * 100}%` }}
          title="Aujourd’hui : part de la période écoulée"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad";
const tones: Record<Tone, string> = {
  ok: "bg-save-soft text-save",
  warn: "bg-warn-soft text-warn",
  bad: "bg-over-soft text-over",
};

export function Alert({ tone, children, action }: { tone: Tone; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl px-3.5 py-2.5 text-[0.9rem] ${tones[tone]}`}>
      <div className="min-w-0 flex-[1_1_15rem]">{children}</div>
      {action}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-w-0 rounded-[10px] border-2 border-line bg-surface-2 focus:border-accent px-3 py-2.5 text-ink placeholder:text-ink-2/70 ${props.className ?? ""}`}
    />
  );
}

export function MoneyInput({
  value,
  onChange,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <TextInput
        {...rest}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8 text-right tabular"
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-2">€</span>
    </div>
  );
}

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-xl border-2 border-ink bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity ${msg ? "opacity-100" : "opacity-0"}`}
        style={{ bottom: "calc(150px + env(safe-area-inset-bottom, 0px))" }}
      >
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}
