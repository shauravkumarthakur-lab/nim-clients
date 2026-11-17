import { requirePortalCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { logoutAction } from "../(auth)/actions";

export const metadata = { title: "Client portal" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePortalCtx();
  const client = await db.client.findFirst({ where: { id: ctx.clientId, orgId: ctx.orgId }, select: { name: true } });
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3"><Logo /><span className="hidden truncate text-[13px] text-muted sm:inline">· {ctx.org.name} client portal</span></div>
          <form action={logoutAction}><Button type="submit" variant="ghost" size="sm" data-testid="portal-logout">Sign out</Button></form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="text-[13px] text-muted">Signed in as {ctx.user.name} · {client?.name}</p>
        {children}
      </main>
    </div>
  );
}
