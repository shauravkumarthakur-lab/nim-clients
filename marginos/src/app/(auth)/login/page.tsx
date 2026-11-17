import Link from "next/link";
import { AuthForm } from "../auth-form";
import { demoLoginAction, loginAction } from "../actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Welcome back. Your numbers are waiting.</p>
      <AuthForm testId="login-form" action={loginAction} submit="Sign in" hidden={next ? { next } : {}}
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }, { name: "password", label: "Password", type: "password", autoComplete: "current-password" }]} />
      <div className="mt-4 flex justify-between text-[13px]">
        <Link href="/forgot-password" className="text-muted hover:text-fg">Forgot password?</Link>
        <Link href="/signup" className="font-medium hover:underline">Create an account</Link>
      </div>
      <div className="mt-8 rounded-xl border border-dashed border-border-strong p-4">
        <p className="text-[13px] font-medium">Explore the demo agency</p>
        <p className="mt-0.5 text-[12px] text-muted">A fictional studio with 3 months of data. Kept separate from real workspaces.</p>
        <form action={async () => { "use server"; await demoLoginAction(); }} className="mt-3">
          <Button type="submit" variant="secondary" size="sm" data-testid="demo-login">Open demo workspace</Button>
        </form>
      </div>
    </>
  );
}
