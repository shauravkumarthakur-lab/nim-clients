import { Tabs } from "@/components/ui/misc";
export function SettingsTabs({ active }: { active: string }) {
  return <Tabs active={active} items={[
    { key: "general", href: "/settings", label: "General" },
    { key: "members", href: "/settings/members", label: "Members" },
    { key: "categories", href: "/settings/categories", label: "Categories & vendors" },
    { key: "integrations", href: "/settings/integrations", label: "AI & integrations" },
    { key: "demo", href: "/settings/demo", label: "Demo data" },
    { key: "audit", href: "/settings/audit", label: "Audit log" },
  ]} />;
}
