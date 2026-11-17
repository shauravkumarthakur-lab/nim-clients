import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCtx } from "@/lib/tenant";
import { Logo } from "@/components/logo";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Set up your agency" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const ctx = await getCtx();
  if (ctx?.role === "CLIENT") redirect("/portal");
  if (ctx && ctx.org.onboardingCompleted) redirect("/dashboard");
  return (
    <div className="min-h-dvh">
      <header className="px-5 py-5 sm:px-8"><Logo /></header>
      <main className="mx-auto max-w-xl px-4 pb-20"><OnboardingWizard userName={session.user.name} /></main>
    </div>
  );
}
