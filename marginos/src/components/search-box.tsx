"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBox({ placeholder = "Search", param = "q" }: { placeholder?: string; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [v, setV] = React.useState(sp.get(param) ?? "");
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get(param) ?? "") === v) return;
      const p = new URLSearchParams(sp.toString());
      if (v) p.set(param, v); else p.delete(param);
      router.replace(`${path}?${p.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [v, sp, param, path, router]);
  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
      <Input aria-label={placeholder} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} className="h-9 pl-8 text-[13px]" data-testid="search" />
    </div>
  );
}
