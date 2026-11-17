import Link from "next/link";
import { AuthForm } from "../auth-form";
import { signupAction } from "../actions";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Set up your agency workspace in about two minutes.</p>
      <AuthForm testId="signup-form" action={signupAction} submit="Create account"
        fields={[
          { name: "name", label: "Your name", autoComplete: "name" },
          { name: "email", label: "Work email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 10 characters, with a letter and a number." },
        ]} />
      <p className="mt-4 text-center text-[13px] text-muted">Already have an account? <Link href="/login" className="font-medium text-fg hover:underline">Sign in</Link></p>
    </>
  );
}
