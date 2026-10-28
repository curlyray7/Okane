"use client";

import { useEffect } from "react";
import { useData } from "@/lib/store";
import { persistStorage } from "@/lib/backup";
import { Onboarding } from "./Onboarding";
import { Shell } from "./Shell";
import { ToastProvider } from "./ui";

export function App() {
  const data = useData();
  const hasData = !!data;
  useEffect(() => {
    // Dès qu’un budget existe, on demande au navigateur de ne pas l’effacer.
    if (hasData) persistStorage();
  }, [hasData]);
  return (
    <ToastProvider>
      {data === undefined ? (
        <div className="grid min-h-[60vh] place-items-center text-ink-2">Chargement…</div>
      ) : data === null ? (
        <Onboarding />
      ) : (
        <Shell data={data} />
      )}
    </ToastProvider>
  );
}
