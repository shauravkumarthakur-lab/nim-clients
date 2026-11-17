import * as React from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-surface-2 text-muted border-border",
  brand: "bg-brand-soft text-brand border-transparent",
  gain: "bg-brand-soft text-gain border-transparent",
  loss: "bg-loss-soft text-loss border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  info: "bg-info-soft text-info border-transparent",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", tones[tone], className)} {...p} />;
}

const STATUS_TONES: Record<string, Tone> = {
  ACTIVE: "gain", COMPLETED: "neutral", PLANNING: "info", ON_HOLD: "warn", CANCELLED: "neutral", PAUSED: "warn", CHURNED: "loss", PROSPECT: "info",
  DRAFT: "neutral", SENT: "info", PARTIALLY_PAID: "warn", PAID: "gain", VOID: "neutral",
  NOT_STARTED: "neutral", IN_PROGRESS: "info", IN_REVIEW: "warn", CHANGES_REQUESTED: "loss", APPROVED: "gain", DELIVERED: "gain",
  LOGGED: "warn", QUOTED: "info", REJECTED: "loss", ABSORBED: "neutral", INVOICED: "gain",
  UNDERUTILISED: "warn", HEALTHY: "gain", OVERLOADED: "loss", NO_CAPACITY: "neutral", UNPAID: "warn",
  OK: "gain", WARNING: "warn", OVER: "loss", NO_BUDGET: "neutral",
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.toLowerCase().replace(/_/g, " ");
  return <Badge tone={STATUS_TONES[status] ?? "neutral"} className={cn("capitalize", className)}>{label}</Badge>;
}
