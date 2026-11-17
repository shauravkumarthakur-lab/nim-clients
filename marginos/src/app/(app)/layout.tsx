import { requireCtx } from "@/lib/tenant";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { NAV } from "@/components/shell/nav";
import { AppShell } from "@/components/shell/app-shell";
import { logoutAction, switchOrgAction } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const orgs = await db.membership.findMany({ where: { userId: ctx.userId }, include: { org: { select: { id: true, name: true } } } });
  const nav = NAV.filter((n) => can(ctx.role, n.perm));
  return (
    <AppShell nav={nav} user={ctx.user} org={{ id: ctx.orgId, name: ctx.org.name, isDemo: ctx.org.isDemo }} orgs={orgs.map((m) => m.org)} role={ctx.role}
      logout={logoutAction} switchOrg={switchOrgAction}>
      {children}
    </AppShell>
  );
}
