import { describe, expect, it } from "vitest";
import { can, PERMISSIONS } from "@/lib/rbac";

describe("RBAC", () => {
  it("clients (portal users) get no internal permissions", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("CLIENT", p)).toBe(p === "PORTAL");
  });
  it("team members can log time but cannot see financials or salaries", () => {
    expect(can("MEMBER", "LOG_TIME")).toBe(true);
    expect(can("MEMBER", "VIEW_FINANCIALS")).toBe(false);
    expect(can("MEMBER", "VIEW_SALARIES")).toBe(false);
    expect(can("MEMBER", "MANAGE_ORG")).toBe(false);
  });
  it("managers see profitability but not salaries; finance manages money", () => {
    expect(can("MANAGER", "VIEW_FINANCIALS")).toBe(true);
    expect(can("MANAGER", "VIEW_SALARIES")).toBe(false);
    expect(can("MANAGER", "MANAGE_FINANCE")).toBe(false);
    expect(can("FINANCE", "MANAGE_FINANCE")).toBe(true);
    expect(can("FINANCE", "MANAGE_WORK")).toBe(false);
  });
  it("only owners/admins manage the organisation", () => {
    expect(can("OWNER", "MANAGE_ORG")).toBe(true);
    expect(can("ADMIN", "MANAGE_ORG")).toBe(true);
    expect(can("FINANCE", "MANAGE_ORG")).toBe(false);
    expect(can(null, "VIEW_FINANCIALS")).toBe(false);
  });
});
