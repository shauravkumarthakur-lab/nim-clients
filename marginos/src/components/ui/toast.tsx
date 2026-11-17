"use client";
import * as React from "react";
import { cn } from "./cn";

type T = { id: number; message: string; tone: "ok" | "error" };
const listeners = new Set<(t: T) => void>();
let n = 0;
export function toast(message: string, tone: "ok" | "error" = "ok") {
  const t = { id: ++n, message, tone };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = React.useState<T[]>([]);
  React.useEffect(() => {
    const l = (t: T) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 4000);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} role="status" className={cn("pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-lg", t.tone === "ok" ? "bg-fg text-bg" : "bg-loss text-white")}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
