"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Variant = "primary" | "accent" | "save" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-surface",
  accent: "bg-accent text-on-accent",
  save: "bg-save text-on-accent",
  ghost: "border border-line text-ink bg-transparent",
  danger: "border border-over text-over bg-transparent",
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
      className={`whitespace-nowrap rounded-xl px-4 py-2.5 font-semibold disabled:opacity-40 ${variants[variant]} ${className}`}
    />
  );
}

export function Panel({
  title,
  children,
  className = "",
  action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-[22px] border border-line bg-surface p-[18px] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bar({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-full bg-track" style={{ height }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }}
      />
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
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[0.93rem] ${tones[tone]}`}>
      <div className="min-w-0 flex-[1_1_15rem]">{children}</div>
      {action}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-w-0 rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-ink placeholder:text-ink-2/70 ${props.className ?? ""}`}
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
        className={`pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-sm text-surface transition-opacity ${msg ? "opacity-100" : "opacity-0"}`}
        style={{ bottom: "calc(150px + env(safe-area-inset-bottom, 0px))" }}
      >
        {msg}
      </div>
    </ToastCtx.Provider>
  );
}
