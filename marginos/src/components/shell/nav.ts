import type { Permission } from "@/lib/rbac";

export interface NavItem { href: string; label: string; icon: string; perm: Permission; mobile?: boolean; group: string }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", perm: "VIEW_FINANCIALS", mobile: true, group: "Overview" },
  { href: "/advisor", label: "AI Advisor", icon: "Sparkles", perm: "USE_ADVISOR", group: "Overview" },
  { href: "/clients", label: "Clients", icon: "Building2", perm: "VIEW_FINANCIALS", mobile: true, group: "Work" },
  { href: "/projects", label: "Projects", icon: "FolderKanban", perm: "VIEW_FINANCIALS", mobile: true, group: "Work" },
  { href: "/production", label: "Production", icon: "Clapperboard", perm: "VIEW_WORK", group: "Work" },
  { href: "/scope", label: "Scope creep", icon: "TriangleAlert", perm: "VIEW_FINANCIALS", group: "Work" },
  { href: "/time", label: "Time", icon: "Timer", perm: "LOG_TIME", mobile: true, group: "Team" },
  { href: "/team", label: "Team", icon: "Users", perm: "VIEW_FINANCIALS", group: "Team" },
  { href: "/freelancers", label: "Freelancers", icon: "UserRoundPlus", perm: "VIEW_FINANCIALS", group: "Team" },
  { href: "/expenses", label: "Expenses", icon: "Receipt", perm: "VIEW_FINANCIALS", group: "Money" },
  { href: "/invoices", label: "Invoices", icon: "FileText", perm: "VIEW_FINANCIALS", group: "Money" },
  { href: "/media", label: "Media", icon: "Megaphone", perm: "VIEW_FINANCIALS", group: "Money" },
  { href: "/reports", label: "Reports", icon: "ChartColumn", perm: "VIEW_FINANCIALS", group: "Money" },
  { href: "/settings", label: "Settings", icon: "Settings", perm: "MANAGE_ORG", group: "Workspace" },
];
