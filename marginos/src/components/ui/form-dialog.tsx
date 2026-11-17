"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Field, Input, Select, Textarea } from "./input";
import { toast } from "./toast";
import { cn } from "./cn";

export type ActionResult = { ok: true; data?: unknown; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
export type FormAction = (prev: unknown, input: FormData | Record<string, unknown>) => Promise<ActionResult>;

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "money" | "hours" | "date" | "select" | "textarea" | "checkbox" | "hidden" | "password";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Spans both columns on desktop. */
  full?: boolean;
  min?: number;
  step?: string;
}

/** Generic, schema-driven create/edit dialog bound to a server action. */
export function FormDialog({
  title, description, action, fields, defaults = {}, submitLabel = "Save", trigger, triggerLabel, triggerVariant = "primary",
  mode = "create", wide, testId, onSuccessMessage,
}: {
  title: string; description?: string; action: FormAction; fields: FieldDef[]; defaults?: Record<string, string | boolean | null | undefined>;
  submitLabel?: string; trigger?: React.ReactNode; triggerLabel?: string; triggerVariant?: "primary" | "secondary" | "ghost" | "brand";
  mode?: "create" | "edit"; wide?: boolean; testId?: string; onSuccessMessage?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [err, setErr] = React.useState<{ error?: string; fieldErrors?: Record<string, string> }>({});
  const [link, setLink] = React.useState<string | null>(null);
  const router = useRouter();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // Make unchecked checkboxes explicit so edits can turn flags off.
    for (const f of fields) if (f.type === "checkbox" && !fd.has(f.name)) fd.set(f.name, "false");
    start(async () => {
      const res = await action(null, fd);
      if (res.ok) {
        setErr({});
        const l = res.data && typeof res.data === "object" && "link" in res.data ? String((res.data as { link: string }).link) : null;
        if (l) { setLink(l); router.refresh(); return; }
        setOpen(false);
        toast(res.message ?? onSuccessMessage ?? (mode === "create" ? "Created" : "Saved"));
        router.refresh();
      } else setErr({ error: res.error, fieldErrors: res.fieldErrors });
    });
  };

  const defaultTrigger =
    mode === "edit" ? (
      <Button variant="ghost" size="sm" aria-label={`Edit ${title}`} data-testid={testId ? `${testId}-open` : undefined}><Pencil size={14} /> <span className="hidden sm:inline">Edit</span></Button>
    ) : (
      <Button variant={triggerVariant} data-testid={testId ? `${testId}-open` : undefined}><Plus size={16} /> {triggerLabel ?? title}</Button>
    );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setErr({}); setLink(null); } }} title={title} description={description} trigger={trigger ?? defaultTrigger} wide={wide}>
      {link ? (
        <div className="flex flex-col gap-3" data-testid={testId ? `${testId}-link` : undefined}>
          <p className="text-sm">Done. Share this link (also emailed, if an email provider is configured):</p>
          <input readOnly value={link} className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(link).then(() => toast("Link copied"))}>Copy link</Button>
            <Button onClick={() => { setOpen(false); setLink(null); }}>Close</Button>
          </div>
        </div>
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-4" data-testid={testId} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => <FieldInput key={f.name} f={f} def={defaults[f.name]} error={err.fieldErrors?.[f.name]} />)}
        </div>
        {err.error ? <p className="rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss" role="alert">{err.error}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending} data-testid={testId ? `${testId}-submit` : undefined}>{pending ? "Saving…" : submitLabel}</Button>
        </div>
      </form>
      )}
    </Dialog>
  );
}

function FieldInput({ f, def, error }: { f: FieldDef; def: string | boolean | null | undefined; error?: string }) {
  const id = `f-${f.name}`;
  const dv = def === null || def === undefined ? undefined : String(def);
  const common = { id, name: f.name, "aria-invalid": error ? true : undefined, required: f.required, placeholder: f.placeholder } as const;
  if (f.type === "hidden") return <input type="hidden" name={f.name} defaultValue={dv} />;
  if (f.type === "checkbox")
    return (
      <label className={cn("flex items-start gap-2.5 text-sm", f.full && "sm:col-span-2")}>
        <input type="checkbox" name={f.name} defaultChecked={def === true || def === "true"} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
        <span>
          <span className="font-medium">{f.label}</span>
          {f.hint ? <span className="block text-xs text-subtle">{f.hint}</span> : null}
        </span>
      </label>
    );
  let control: React.ReactNode;
  if (f.type === "select")
    control = (
      <Select {...common} defaultValue={dv ?? ""}>
        {!f.required ? <option value="">—</option> : null}
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    );
  else if (f.type === "textarea") control = <Textarea {...common} defaultValue={dv} />;
  else {
    const t = f.type ?? "text";
    const isNum = t === "money" || t === "hours" || t === "number";
    control = (
      <Input
        {...common}
        type={t === "money" || t === "hours" ? "text" : t}
        inputMode={isNum ? "decimal" : undefined}
        step={f.step}
        min={f.min}
        defaultValue={dv}
        className={isNum ? "num" : undefined}
      />
    );
  }
  return <Field label={f.label + (f.required ? " *" : "")} htmlFor={id} error={error} hint={f.hint} className={f.full || f.type === "textarea" ? "sm:col-span-2" : undefined}>{control}</Field>;
}

/** Confirm-then-run button for destructive or important actions. Never runs without explicit confirmation. */
export function ConfirmAction({ action, payload, label, title, description, confirmLabel = "Confirm", variant = "danger", icon = "trash", testId, size = "sm" }: {
  action: FormAction; payload: Record<string, unknown>; label: string; title: string; description: string;
  confirmLabel?: string; variant?: "danger" | "primary" | "brand"; icon?: "trash" | "none"; testId?: string; size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string>();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen} title={title} description={description}
      trigger={
        <Button variant={variant === "danger" ? "ghost" : "secondary"} size={size} data-testid={testId} className={variant === "danger" ? "text-loss hover:text-loss" : undefined}>
          {icon === "trash" ? <Trash2 size={14} /> : null}<span className={icon === "trash" ? "hidden sm:inline" : undefined}>{label}</span>
        </Button>
      }>
      {error ? <p className="mb-3 rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        <Button variant={variant} disabled={pending} data-testid={testId ? `${testId}-confirm` : undefined}
          onClick={() => start(async () => {
            const res = await action(null, payload);
            if (res.ok) { setOpen(false); toast(res.message ?? "Done"); router.refresh(); }
            else setError(res.error);
          })}>
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** One-click (non-destructive) action button. */
export function ActionButton({ action, payload, children, variant = "secondary", size = "sm", testId }: {
  action: FormAction; payload: Record<string, unknown>; children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "brand"; size?: "sm" | "md"; testId?: string;
}) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <Button variant={variant} size={size} disabled={pending} data-testid={testId}
      onClick={() => start(async () => {
        const res = await action(null, payload);
        if (res.ok) { toast(res.message ?? "Done"); router.refresh(); } else toast(res.error, "error");
      })}>
      {pending ? "Working…" : children}
    </Button>
  );
}
