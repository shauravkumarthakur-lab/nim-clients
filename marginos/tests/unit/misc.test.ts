import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";
import { resolvePeriod } from "@/lib/period";
import { demoAnswer } from "@/lib/advisor/demo";

describe("rate limiter", () => {
  it("blocks after the limit within the window", () => {
    const key = "t:" + Math.random();
    const results = Array.from({ length: 4 }, () => rateLimit(key, 3, 60_000).ok);
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("period resolution", () => {
  const now = new Date("2026-11-17T10:00:00Z");
  it("this month is month-to-date (never extends into the future)", () => {
    const { period } = resolvePeriod({}, "this_month", now);
    expect(period.from.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(period.to.toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });
  it("custom range is inclusive of the end date", () => {
    const { period } = resolvePeriod({ period: "custom", from: "2026-09-01", to: "2026-09-30" }, "this_month", now);
    expect(period.to.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
  it("invalid custom input falls back safely", () => {
    const { key } = resolvePeriod({ period: "custom", from: "garbage", to: "2026-09-30" }, "this_month", now);
    expect(key).toBe("this_month");
  });
  it("financial year starts in April", () => {
    expect(resolvePeriod({ period: "fy" }, "this_month", now).period.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("demo advisor", () => {
  const facts = {
    currency: "INR", targetContributionMarginPct: 35,
    clientsLast3Months: [{ name: "Low Co", href: "/clients/1", revenue: 100000, directCosts: 90000, teamTimeCost: 50000, freelancerCost: 30000, productionCost: 10000, contributionProfit: 10000, contributionMarginPct: 10, allocatedOverhead: 5000, netProfit: 5000, outOfScopeCost: 0 }],
    productionEconomicsByType: [{ type: "Reel", units: 10, avgCostPerUnit: 4500, avgRevenuePerUnit: 9000, avgProfitPerUnit: 4500, avgHoursPerUnit: 9, avgRevisions: 1.5, marginPct: 50 }],
    costPerShootDay: { shootDays: 4, totalCost: 80000, perDay: 20000 },
    projects: [], utilisationLastMonth: [], scopeCreep: { thisMonthToDate: { outOfScopeHours: 0, cost: 0, recovered: 0, unbilled: 0, pendingRequests: 0 }, last3Months: { cost: 0, unbilled: 0 }, openChangeRequests: [] },
    estimates: { feeNeededForTargetMarginByClient: [] }, companyLast3Months: {},
  } as never;
  it("answers from facts only and labels actuals", () => {
    const a = demoAnswer("Which client is the least profitable?", facts);
    expect(a.kind).toBe("actual");
    expect(a.text).toContain("Low Co");
    expect(a.text).toContain("10.0%");
    expect(a.sources[0].href).toBe("/clients/1");
  });
  it("computes cost of a reel from recorded data", () => {
    expect(demoAnswer("What is the actual cost of producing a reel?", facts).text).toContain("₹4,500");
  });
  it("admits when it cannot map a question instead of inventing", () => {
    const a = demoAnswer("What is the weather?", facts);
    expect(a.kind).toBe("unknown");
    expect(a.text).not.toMatch(/₹/);
  });
});
