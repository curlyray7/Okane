"use client";

import { useData } from "@/lib/store";
import { Onboarding } from "./Onboarding";
import { Shell } from "./Shell";
import { ToastProvider } from "./ui";

export function App() {
  const data = useData();
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
