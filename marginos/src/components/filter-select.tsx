"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";

export function FilterSelect({ param, label, options }: { param: string; label: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <Select aria-label={label} className="h-9 w-full text-[13px] sm:w-60" value={sp.get(param) ?? ""} data-testid={`filter-${param}`}
      onChange={(e) => { const p = new URLSearchParams(sp.toString()); if (e.target.value) p.set(param, e.target.value); else p.delete(param); router.push(`${path}?${p.toString()}`); }}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}
