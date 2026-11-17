import { describe, expect, it } from "vitest";
import { parseCsv, validateRows, type Lookups } from "@/lib/csv-import";
import { toCsv } from "@/lib/reports";

const lk: Lookups = {
  categories: new Map([["equipment rental", "cat1"]]), vendors: new Map([["cinekit", "v1"]]),
  projects: new Map([["launch", { id: "p1", clientId: "c1" }]]), clients: new Map([["acme", "c9"]]),
  employees: new Map([["ed@x.com", { id: "e1", rate: "500.00" }]]),
};

describe("CSV import", () => {
  it("parses headers case-insensitively and strips BOM", () => {
    const { rows } = parseCsv("﻿Date,Amount,Description,Category\n2026-10-01,\"₹1,250.50\",Lens,Equipment rental\n");
    expect(rows[0].date).toBe("2026-10-01");
    const v = validateRows("expenses", rows, lk);
    expect(v.errors).toEqual([]);
    expect(v.records[0].amount).toBe("1250.50");
  });
  it("resolves the client from the project, never from input", () => {
    const { rows } = parseCsv("date,amount,description,category,project,client\n2026-10-01,100,X,Equipment rental,Launch,Acme\n");
    const v = validateRows("expenses", rows, lk);
    expect(v.records[0].clientId).toBe("c1");
  });
  it("rejects the whole file when any row is invalid (all-or-nothing)", () => {
    const { rows } = parseCsv("date,amount,description,category\n2026-10-01,100,ok,Equipment rental\n10/01/2026,abc,,Nope\n");
    const v = validateRows("expenses", rows, lk);
    expect(v.records).toEqual([]);
    expect(v.errors[0]).toMatch(/Row 3/);
  });
  it("validates time entries against employees and hours range", () => {
    const { rows } = parseCsv("date,employee_email,project,hours,work_type\n2026-10-01,ed@x.com,Launch,3.5,editing\n2026-10-02,ed@x.com,Launch,30,EDITING\n");
    const v = validateRows("time", rows, lk);
    expect(v.errors).toEqual(["Row 3: hours must be between 0 and 24"]);
  });
  it("validates clients", () => {
    const { rows } = parseCsv("name,contract_value,billing_frequency,email\nNew Co,150000,monthly,a@b.co\nX,abc,MONTHLY,\n");
    const v = validateRows("clients", rows, lk);
    expect(v.errors).toEqual(["Row 3: name is required"]);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formula injection and quotes properly", () => {
    const csv = toCsv({ key: "k", title: "t", description: "", columns: [{ header: "Name", type: "text" }, { header: "Amount", type: "money" }], rows: [["=HYPERLINK(\"x\")", -1250.5], ["a, \"b\"", 3]] });
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")",-1250.50`);
    expect(lines[2]).toBe(`"a, ""b""",3.00`); // money columns always carry 2 decimals
  });
});
