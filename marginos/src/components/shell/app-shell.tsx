"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "lucide-react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { useTheme } from "next-themes";
import { Logo, LogoMark } from "@/components/logo";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import type { NavItem } from "./nav";

type IconName = keyof typeof Icons;
const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const C = Icons[name as IconName] as React.ComponentType<{ size?: number }>;
  return C ? <C size={size} /> : null;
};

export function AppShell({ nav, user, org, orgs, role, children, logout, switchOrg }: {
  nav: NavItem[];
  user: { name: string; email: string };
  org: { id: string; name: string; isDemo: boolean };
  orgs: { id: string; name: string }[];
  role: string;
  children: React.ReactNode;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
}) {
  const path = usePathname();
  const [more, setMore] = React.useState(false);
  const active = (href: string) => path === href || path.startsWith(href + "/");
  const groups = [...new Set(nav.map((n) => n.group))];
  const mobile = nav.filter((n) => n.mobile).slice(0, 4);
  React.useEffect(() => setMore(false), [path]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center px-4"><Link href="/dashboard"><Logo /></Link></div>
        <OrgSwitcher org={org} orgs={orgs} switchOrg={switchOrg} />
        <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
          {groups.map((g) => (
            <div key={g} className="mt-4">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-subtle">{g}</p>
              {nav.filter((n) => n.group === g).map((n) => (
                <Link key={n.href} href={n.href} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px]", active(n.href) ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                  <Icon name={n.icon} size={16} /> {n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-2"><UserMenu user={user} role={role} logout={logout} /></div>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2"><LogoMark size={26} /><span className="max-w-[45vw] truncate text-[15px] font-semibold">{org.name}</span></Link>
        <UserMenu user={user} role={role} logout={logout} compact />
      </header>

      <div className="lg:pl-60">
        {org.isDemo ? (
          <div className="no-print border-b border-warn/30 bg-warn-soft px-4 py-1.5 text-center text-[12px] text-warn" data-testid="demo-banner">
            Demo organisation — all names and figures are fictional. <Link href="/settings/demo" className="underline">Reset demo data</Link>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
      </div>

      {/* Android bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {mobile.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active(n.href) ? "text-brand" : "text-muted")}>
              <Icon name={n.icon} size={20} />{n.label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-muted" data-testid="mobile-more">
            <Icons.Menu size={20} />More
          </button>
        </div>
      </nav>
      <Dialog open={more} onOpenChange={setMore} title="Menu">
        <div className="mb-3"><OrgSwitcher org={org} orgs={orgs} switchOrg={switchOrg} /></div>
        <div className="grid grid-cols-3 gap-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border p-2 text-center text-[12px]", active(n.href) ? "border-brand text-brand" : "text-fg")}>
              <Icon name={n.icon} size={20} />{n.label}
            </Link>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function OrgSwitcher({ org, orgs, switchOrg }: { org: { id: string; name: string; isDemo: boolean }; orgs: { id: string; name: string }[]; switchOrg: (id: string) => Promise<void> }) {
  if (orgs.length < 2)
    return <div className="mx-3 rounded-lg border border-border px-3 py-2 text-[13px]"><p className="truncate font-medium">{org.name}</p><p className="text-[11px] text-subtle">{org.isDemo ? "Demo workspace" : "Workspace"}</p></div>;
  return (
    <form className="mx-3" action={async (fd) => switchOrg(String(fd.get("orgId")))}>
      <label className="sr-only" htmlFor="org-switch">Workspace</label>
      <select id="org-switch" name="orgId" defaultValue={org.id} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-[13px] font-medium">
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}

function UserMenu({ user, role, logout, compact }: { user: { name: string; email: string }; role: string; logout: () => Promise<void>; compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <DM.Root>
      <DM.Trigger className={cn("flex items-center gap-2 rounded-md text-left hover:bg-surface-2", compact ? "p-1" : "w-full p-2")} data-testid="user-menu">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-semibold text-brand">{initials}</span>
        {!compact ? <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{user.name}</span><span className="block truncate text-[11px] text-subtle">{role.toLowerCase()} · {user.email}</span></span> : null}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-xl border border-border bg-surface p-1 text-[13px] shadow-lg">
          <DM.Label className="px-2 py-1.5 text-[11px] text-subtle">Theme</DM.Label>
          {(["light", "dark", "system"] as const).map((t) => (
            <DM.Item key={t} onSelect={() => setTheme(t)} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 capitalize outline-none data-[highlighted]:bg-surface-2">
              {t}{theme === t ? <Icons.Check size={14} /> : null}
            </DM.Item>
          ))}
          <DM.Separator className="my-1 h-px bg-border" />
          <DM.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-loss outline-none data-[highlighted]:bg-surface-2" data-testid="logout">
            <Icons.LogOut size={14} /> Sign out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
