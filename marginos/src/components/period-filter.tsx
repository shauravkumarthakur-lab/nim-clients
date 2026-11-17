"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  ["this_month", "This month"], ["last_month", "Last month"], ["last_3_months", "Last 3 months"],
  ["last_6_months", "Last 6 months"], ["ytd", "Year to date"], ["fy", "Financial year"], ["custom", "Custom range…"],
] as const;

export function PeriodFilter({ value }: { value: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = React.useState(value === "custom");
  const [from, setFrom] = React.useState(sp.get("from") ?? "");
  const [to, setTo] = React.useState(sp.get("to") ?? "");
  const go = (q: Record<string, string>) => {
    const p = new URLSearchParams(sp.toString());
    ["period", "from", "to"].forEach((k) => p.delete(k));
    Object.entries(q).forEach(([k, v]) => p.set(k, v));
    router.push(`${path}?${p.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarRange size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <Select aria-label="Period" data-testid="period-filter" className="h-9 w-48 pl-8 text-[13px]" value={custom ? "custom" : value}
          onChange={(e) => { if (e.target.value === "custom") setCustom(true); else { setCustom(false); go({ period: e.target.value }); } }}>
          {OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
      {custom ? (
        <div className="flex items-center gap-2">
          <Input type="date" aria-label="From" className="h-9 w-[9.5rem] text-[13px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="To" className="h-9 w-[9.5rem] text-[13px]" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button size="sm" onClick={() => from && to && go({ period: "custom", from, to })}>Apply</Button>
        </div>
      ) : null}
    </div>
  );
}
