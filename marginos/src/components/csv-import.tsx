"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";

/** Upload a CSV to /api/import/<entity>. Shows per-row validation errors; nothing is imported if any row fails. */
export function CsvImport({ entity, label = "Import CSV", help }: { entity: "expenses" | "clients" | "time"; label?: string; help: string }) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{ created?: number; errors?: string[]; error?: string } | null>(null);
  const router = useRouter();
  const onFile = async (file: File) => {
    setPending(true); setResult(null);
    const res = await fetch(`/api/import/${entity}`, { method: "POST", headers: { "content-type": "text/csv" }, body: await file.text() });
    const json = await res.json().catch(() => ({ error: "Unexpected response" }));
    setPending(false); setResult(json);
    if (res.ok && json.created !== undefined) { toast(`Imported ${json.created} rows`); router.refresh(); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }} title={label} description="All rows are validated first; if any row has an error, nothing is imported."
      trigger={<Button variant="secondary" size="sm" data-testid={`import-${entity}`}><Upload size={14} /> {label}</Button>}>
      <p className="text-[13px] text-muted">{help}</p>
      <a className="mt-2 inline-block text-[13px] underline" href={`/api/import/${entity}?template=1`}>Download template</a>
      <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong p-6 text-center text-sm hover:bg-surface-2">
        <Upload size={20} className="text-subtle" />{pending ? "Importing…" : "Choose a .csv file"}
        <input type="file" accept=".csv,text/csv" className="sr-only" data-testid={`import-${entity}-file`} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {result?.created !== undefined ? <p className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-[13px] text-brand" data-testid="import-result">Imported {result.created} rows.</p> : null}
      {result?.error ? <p className="mt-3 rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss">{result.error}</p> : null}
      {result?.errors?.length ? <ul className="mt-3 max-h-48 overflow-y-auto rounded-md bg-loss-soft px-3 py-2 text-[12px] text-loss" data-testid="import-errors">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul> : null}
    </Dialog>
  );
}
