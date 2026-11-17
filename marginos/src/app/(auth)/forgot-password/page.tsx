import Link from "next/link";
import { AuthForm } from "../auth-form";
import { forgotPasswordAction } from "../actions";
import { devMailboxEnabled } from "@/lib/email/send";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      <AuthForm testId="forgot-form" action={forgotPasswordAction} submit="Send reset link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} />
      {devMailboxEnabled() ? <p className="mt-4 text-[12px] text-subtle">Development mode: no email provider is configured, so emails appear in the <Link href="/dev/mailbox" className="underline">dev mailbox</Link>.</p> : null}
      <p className="mt-4 text-center text-[13px]"><Link href="/login" className="text-muted hover:text-fg">Back to sign in</Link></p>
    </>
  );
}
