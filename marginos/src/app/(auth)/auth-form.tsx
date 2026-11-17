"use client";
import * as React from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import type { AuthState } from "./actions";

export interface AuthField { name: string; label: string; type?: string; autoComplete?: string; hint?: string; defaultValue?: string }

export function AuthForm({ action, fields, submit, hidden = {}, testId }: {
  action: (s: AuthState, fd: FormData) => Promise<AuthState>;
  fields: AuthField[];
  submit: string;
  hidden?: Record<string, string>;
  testId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid={testId} noValidate>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={f.name} error={state?.fieldErrors?.[f.name]} hint={f.hint}>
          <Input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} defaultValue={f.defaultValue}
            aria-invalid={state?.fieldErrors?.[f.name] ? true : undefined} />
        </Field>
      ))}
      {state?.error ? <p className="rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss" role="alert">{state.error}</p> : null}
      {state?.message ? <p className="rounded-md bg-brand-soft px-3 py-2 text-[13px] text-brand" role="status">{state.message}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>{pending ? "Please wait…" : submit}</Button>
    </form>
  );
}
