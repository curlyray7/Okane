"use client";

import { useState } from "react";

export type Mood = "neutre" | "contente" | "inquiete" | "victoire";

/** Mascotte : dessins dans public/mascotte/<mood>.png, avec un visage SVG de secours tant qu’ils manquent. */
/** `framed` : dans un médaillon rond, pour que la tenue sombre se détache aussi en thème sombre. */
export function Mascot({ mood, size = 96, framed = false, className = "" }: { mood: Mood; size?: number; framed?: boolean; className?: string }) {
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  return (
    <div
      className={`relative flex-none ${framed ? "overflow-hidden rounded-full border-2 border-ink bg-accent-soft shadow-ink-sm" : ""} ${mood === "victoire" ? "power-up" : "float"} ${className}`}
      style={{ width: size, height: size }}
    >
      {missing[mood] ? (
        <Fallback mood={mood} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={mood}
          src={`/mascotte/${mood}.png`}
          alt=""
          width={size}
          height={size}
          className={`h-full w-full ${framed ? "object-cover object-top" : "object-contain"}`}
          onError={() => setMissing((m) => ({ ...m, [mood]: true }))}
        />
      )}
    </div>
  );
}

function Fallback({ mood }: { mood: Mood }) {
  const happy = mood === "contente" || mood === "victoire";
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      {mood === "victoire" &&
        Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M50 2 L53 14 L47 14 Z" fill="var(--pop)" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      <circle cx="50" cy="52" r="34" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
      <circle cx="50" cy="52" r="25" fill="none" stroke="var(--on-accent)" strokeWidth="2.5" strokeDasharray="4 5" opacity=".55" />
      <path d="M18 38 Q50 26 82 38 L80 46 Q50 35 20 46 Z" fill="var(--pop)" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      {happy ? (
        <>
          <path d="M33 55 q6 -7 12 0" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
          <path d="M55 55 q6 -7 12 0" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
          <path d="M38 66 q12 12 24 0 z" fill="var(--ink)" />
        </>
      ) : (
        <>
          <ellipse cx="39" cy="56" rx="5" ry="6.5" fill="var(--ink)" />
          <ellipse cx="61" cy="56" rx="5" ry="6.5" fill="var(--ink)" />
          <circle cx="40.5" cy="54" r="1.8" fill="var(--on-hero)" />
          <circle cx="62.5" cy="54" r="1.8" fill="var(--on-hero)" />
          {mood === "inquiete" ? (
            <>
              <path d="M41 72 q9 -6 18 0" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
              <path d="M80 30 q6 10 0 14 q-6 -4 0 -14 z" fill="var(--pop)" stroke="var(--ink)" strokeWidth="2" />
            </>
          ) : (
            <path d="M42 69 q8 6 16 0" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}

/** Mascotte + bulle de dialogue. */
export function MascotSays({ mood, children, size = 92 }: { mood: Mood; children: React.ReactNode; size?: number }) {
  return (
    <div className="flex items-end gap-2">
      <Mascot mood={mood} size={size} framed />
      <div className="relative mb-3 min-w-0 flex-1 rounded-2xl border-2 border-ink bg-surface px-3.5 py-2.5 text-[0.93rem] text-ink shadow-ink-sm">
        <span className="absolute bottom-3 -left-[9px] h-4 w-4 rotate-45 border-b-2 border-l-2 border-ink bg-surface" aria-hidden="true" />
        <span className="relative">{children}</span>
      </div>
    </div>
  );
}
