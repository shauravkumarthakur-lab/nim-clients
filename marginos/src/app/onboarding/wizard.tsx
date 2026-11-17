"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";
import { BILLING_MODELS, CURRENCIES, DEFAULT_EXPENSE_CATEGORIES, DEPARTMENTS, EMPLOYEE_RANGES, INDUSTRIES, REVENUE_RANGES } from "@/lib/constants";
import { completeOnboarding, type OnboardingInput } from "./actions";

const STEPS = ["Agency", "Size & billing", "Team", "Expenses", "Clients"];

export function OnboardingWizard({ userName }: { userName: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [err, setErr] = React.useState<string>();
  const [pending, start] = React.useTransition();
  const [v, setV] = React.useState<OnboardingInput>({
    name: "", industry: INDUSTRIES[0], employeeCount: EMPLOYEE_RANGES[1], currency: "INR", revenueRange: REVENUE_RANGES[1],
    billingModel: BILLING_MODELS[3], team: [], categories: DEFAULT_EXPENSE_CATEGORIES.map((c) => c.name), customCategories: [], clients: [],
  });
  const set = <K extends keyof OnboardingInput>(k: K, val: OnboardingInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const [custom, setCustom] = React.useState("");

  const next = () => {
    setErr(undefined);
    if (step === 0 && v.name.trim().length < 2) return setErr("Enter your agency name.");
    if (step === 2 && v.team.some((t) => !t.name.trim() || !/^\d+(\.\d{1,2})?$/.test(t.monthlySalary))) return setErr("Each team member needs a name and a monthly salary (numbers only).");
    if (step === 4 && v.clients.some((c) => !c.name.trim() || (c.contractValue && !/^\d+(\.\d{1,2})?$/.test(c.contractValue)))) return setErr("Each client needs a name; contract value must be a number.");
    if (step < STEPS.length - 1) return setStep(step + 1);
    start(async () => {
      const res = await completeOnboarding(v);
      if (res.ok) router.replace("/dashboard");
      else setErr(res.error + (res.fieldErrors ? " " + Object.values(res.fieldErrors).join(" ") : ""));
    });
  };

  return (
    <div data-testid="onboarding">
      <p className="text-sm text-muted">Welcome, {userName.split(" ")[0]}.</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Let&apos;s set up your agency</h1>
      <ol className="mt-5 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-brand" : "bg-border")} />
            <span className={cn("mt-1.5 hidden text-[11px] sm:block", i === step ? "text-fg" : "text-subtle")}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] text-subtle sm:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

      <div className="card mt-6 flex flex-col gap-4 p-5">
        {step === 0 && (
          <>
            <Field label="Agency name" htmlFor="name"><Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Lantern & Loom Studio" autoFocus /></Field>
            <Field label="Industry / category" htmlFor="industry"><Select id="industry" value={v.industry} onChange={(e) => set("industry", e.target.value)}>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</Select></Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field label="Number of employees" htmlFor="emp"><Select id="emp" value={v.employeeCount} onChange={(e) => set("employeeCount", e.target.value)}>{EMPLOYEE_RANGES.map((i) => <option key={i}>{i}</option>)}</Select></Field>
            <Field label="Currency" htmlFor="cur" hint="All amounts in this workspace use this currency."><Select id="cur" value={v.currency} onChange={(e) => set("currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
            <Field label="Monthly revenue range" htmlFor="rev"><Select id="rev" value={v.revenueRange} onChange={(e) => set("revenueRange", e.target.value)}>{REVENUE_RANGES.map((i) => <option key={i}>{i}</option>)}</Select></Field>
            <Field label="Billing model" htmlFor="bill"><Select id="bill" value={v.billingModel} onChange={(e) => set("billingModel", e.target.value)}>{BILLING_MODELS.map((i) => <option key={i}>{i}</option>)}</Select></Field>
          </>
        )}
        {step === 2 && (
          <>
            <div><p className="font-medium">Team setup</p><p className="text-[13px] text-muted">Add salaried team members so MarginOS can calculate the real cost of an hour. You can skip and add them later.</p></div>
            {v.team.map((t, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                <Input aria-label="Name" placeholder="Name" value={t.name} onChange={(e) => set("team", v.team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Designation" placeholder="Designation" value={t.designation} onChange={(e) => set("team", v.team.map((x, j) => (j === i ? { ...x, designation: e.target.value } : x)))} />
                <Select aria-label="Department" value={t.department} onChange={(e) => set("team", v.team.map((x, j) => (j === i ? { ...x, department: e.target.value } : x)))}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</Select>
                <Input aria-label="Monthly salary" inputMode="decimal" placeholder="Monthly salary" className="num" value={t.monthlySalary} onChange={(e) => set("team", v.team.map((x, j) => (j === i ? { ...x, monthlySalary: e.target.value } : x)))} />
                <button className="col-span-2 justify-self-end text-[12px] text-loss" onClick={() => set("team", v.team.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => set("team", [...v.team, { name: "", designation: "", department: "Creative", monthlySalary: "" }])}><Plus size={16} /> Add team member</Button>
          </>
        )}
        {step === 3 && (
          <>
            <div><p className="font-medium">Expense categories</p><p className="text-[13px] text-muted">Choose the categories you use. Categories determine how costs roll into profitability.</p></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEFAULT_EXPENSE_CATEGORIES.map((c) => (
                <label key={c.name} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={v.categories.includes(c.name)}
                    onChange={(e) => set("categories", e.target.checked ? [...v.categories, c.name] : v.categories.filter((x) => x !== c.name))} />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Input aria-label="Custom category" placeholder="Add a custom category" value={custom} onChange={(e) => setCustom(e.target.value)} />
              <Button variant="secondary" onClick={() => { if (custom.trim()) { set("customCategories", [...v.customCategories, custom.trim()]); setCustom(""); } }}>Add</Button>
            </div>
            {v.customCategories.length ? (
              <div className="flex flex-wrap gap-2">{v.customCategories.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[12px]">{c}<button aria-label={`Remove ${c}`} onClick={() => set("customCategories", v.customCategories.filter((x) => x !== c))}><X size={12} /></button></span>)}</div>
            ) : null}
          </>
        )}
        {step === 4 && (
          <>
            <div><p className="font-medium">Active clients</p><p className="text-[13px] text-muted">Add the clients you currently serve with their monthly retainer or contract value. Optional.</p></div>
            {v.clients.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input aria-label="Client name" placeholder="Client name" value={c.name} onChange={(e) => set("clients", v.clients.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Contract value" inputMode="decimal" placeholder="Contract value" className="num max-w-36" value={c.contractValue} onChange={(e) => set("clients", v.clients.map((x, j) => (j === i ? { ...x, contractValue: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" aria-label="Remove client" onClick={() => set("clients", v.clients.filter((_, j) => j !== i))}><X size={16} /></Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => set("clients", [...v.clients, { name: "", contractValue: "" }])}><Plus size={16} /> Add client</Button>
          </>
        )}
        {err ? <p className="rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss" role="alert">{err}</p> : null}
      </div>
      <div className="mt-4 flex justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Back</Button>
        <Button onClick={next} disabled={pending} data-testid="onboarding-next">{step === STEPS.length - 1 ? (pending ? "Creating workspace…" : "Finish setup") : "Continue"}</Button>
      </div>
    </div>
  );
}
