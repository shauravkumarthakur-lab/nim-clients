import * as React from "react";
import Link from "next/link";
import { cn } from "./cn";

export function PageHeader({ title, description, actions, back }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? <Link href={back.href} className="mb-1 inline-block text-[13px] text-muted hover:text-fg">← {back.label}</Link> : null}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-subtle">{icon}</div> : null}
      <p className="font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, sub, tone, href, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "gain" | "loss" | "warn"; href?: string; className?: string }) {
  const body = (
    <>
      <p className="text-[12px] font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p className={cn("num mt-1.5 text-[22px] font-semibold leading-none sm:text-2xl", tone === "gain" && "text-gain", tone === "loss" && "text-loss", tone === "warn" && "text-warn")}>{value}</p>
      {sub ? <div className="mt-1.5 text-[12px] text-muted">{sub}</div> : null}
    </>
  );
  const cls = cn("card block p-4", href && "transition hover:border-border-strong", className);
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Bar({ value, max = 100, tone = "brand", className }: { value: number; max?: number; tone?: "brand" | "loss" | "warn"; className?: string }) {
  const w = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <div className={cn("h-full rounded-full", tone === "brand" && "bg-brand", tone === "loss" && "bg-loss", tone === "warn" && "bg-warn")} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <div className="no-print -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-lg border border-border bg-surface p-1">
        {items.map((t) => (
          <Link key={t.key} href={t.href} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium whitespace-nowrap", active === t.key ? "bg-fg text-bg" : "text-muted hover:text-fg")}>{t.label}</Link>
        ))}
      </div>
    </div>
  );
}

/** Signed money with colour. */
export function Signed({ children, value, className }: { children: React.ReactNode; value: number | null | undefined; className?: string }) {
  return <span className={cn("num", value !== null && value !== undefined && value < 0 && "text-loss", className)}>{children}</span>;
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return <div className={cn("rounded-lg px-3 py-2 text-[13px]", tone === "info" ? "bg-info-soft text-info" : "bg-warn-soft text-warn")}>{children}</div>;
}
