import type { FieldDef } from "@/components/ui/form-dialog";
import { enumOptions } from "@/lib/options";
import { DELIVERABLE_TYPES, DEPARTMENTS, EXPENSE_KINDS, SCOPE_TYPES, WORK_TYPES } from "@/lib/constants";

type Opt = { value: string; label: string }[];

/** Field definitions shared between create and edit dialogs. */
export const clientFields = (employees: Opt): FieldDef[] => [
  { name: "name", label: "Client name", required: true },
  { name: "company", label: "Legal / company name" },
  { name: "industry", label: "Industry" },
  { name: "status", label: "Status", type: "select", required: true, options: enumOptions(["ACTIVE", "PAUSED", "CHURNED", "PROSPECT"]) },
  { name: "contactName", label: "Contact person" },
  { name: "email", label: "Contact email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "accountManagerId", label: "Account manager", type: "select", options: employees },
  { name: "contractValue", label: "Contract value", type: "money", hint: "Retainer per billing period, or total project fee" },
  { name: "billingFrequency", label: "Billing frequency", type: "select", required: true, options: enumOptions(["MONTHLY", "QUARTERLY", "MILESTONE", "ONE_TIME", "ANNUAL"]) },
  { name: "contractStart", label: "Contract start", type: "date" },
  { name: "contractEnd", label: "Contract end", type: "date" },
  { name: "address", label: "Address", full: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const projectFields = (clients: Opt, employees: Opt): FieldDef[] => [
  { name: "name", label: "Project name", required: true, full: true },
  { name: "clientId", label: "Client", type: "select", required: true, options: clients },
  { name: "managerId", label: "Project manager", type: "select", options: employees },
  { name: "contractValue", label: "Contract value (fee)", type: "money", required: true },
  { name: "budget", label: "Cost budget", type: "money", required: true, hint: "What you plan to spend delivering it" },
  { name: "budgetHours", label: "Budgeted hours", type: "hours" },
  { name: "targetMarginPct", label: "Target margin %", type: "number", hint: "Blank = workspace default" },
  { name: "startDate", label: "Start date", type: "date" },
  { name: "endDate", label: "End date", type: "date" },
  { name: "revisionLimit", label: "Revisions included", type: "number", required: true },
  { name: "status", label: "Status", type: "select", required: true, options: enumOptions(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]) },
  { name: "description", label: "Description", type: "textarea" },
  { name: "sharedWithClient", label: "Share with client portal", type: "checkbox", full: true, hint: "Client users can see progress, deliverables and approved changes." },
];

export const deliverableFields = (projects: Opt | null): FieldDef[] => [
  ...(projects ? [{ name: "projectId", label: "Project", type: "select", required: true, options: projects, full: true } as FieldDef] : []),
  { name: "title", label: "Title", required: true, full: true },
  { name: "type", label: "Type", type: "select", required: true, options: [...DELIVERABLE_TYPES] },
  { name: "status", label: "Status", type: "select", required: true, options: enumOptions(["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "DELIVERED"]) },
  { name: "quantityContracted", label: "Quantity contracted", type: "number", required: true, min: 0 },
  { name: "quantityCompleted", label: "Quantity completed", type: "number", required: true, min: 0 },
  { name: "revisionCount", label: "Revisions so far", type: "number", min: 0 },
  { name: "revisionLimit", label: "Revision limit", type: "number", hint: "Blank = project default" },
  { name: "shootDays", label: "Shoot days", type: "hours" },
  { name: "revenueAllocation", label: "Revenue allocation", type: "money", hint: "Portion of the fee for this line" },
  { name: "dueDate", label: "Due date", type: "date" },
  { name: "outOfScope", label: "Outside original contract (scope creep)", type: "checkbox", full: true },
  { name: "sharedWithClient", label: "Visible in client portal for review", type: "checkbox", full: true },
];

export const timeFields = (employees: Opt, projects: Opt, deliverables: Opt, fixedEmployee?: boolean): FieldDef[] => [
  ...(fixedEmployee ? [] : [{ name: "employeeId", label: "Team member", type: "select", required: true, options: employees } as FieldDef]),
  { name: "date", label: "Date", type: "date", required: true },
  { name: "projectId", label: "Project", type: "select", required: true, options: projects, full: true },
  { name: "deliverableId", label: "Deliverable", type: "select", options: deliverables, full: true },
  { name: "hours", label: "Hours", type: "hours", required: true },
  { name: "workType", label: "Work type", type: "select", required: true, options: WORK_TYPES },
  { name: "billable", label: "Billable", type: "checkbox" },
  { name: "outOfScope", label: "Outside contracted scope", type: "checkbox" },
  { name: "notes", label: "Notes", type: "textarea" },
];

export const employeeFields: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "department", label: "Department", type: "select", required: true, options: DEPARTMENTS.map((d) => ({ value: d, label: d })) },
  { name: "designation", label: "Designation", required: true },
  { name: "monthlySalary", label: "Monthly salary (CTC)", type: "money", required: true },
  { name: "benefitsLoadPct", label: "Employer load %", type: "number", hint: "PF, insurance, equipment, benefits on top of salary" },
  { name: "monthlyHours", label: "Working hours / month", type: "hours", required: true, hint: "Capacity, e.g. 176" },
  { name: "joinedOn", label: "Joined on", type: "date" },
  { name: "leftOn", label: "Last working day", type: "date" },
  { name: "active", label: "Active", type: "checkbox" },
];

export const freelancerFields: FieldDef[] = [
  { name: "name", label: "Name", required: true },
  { name: "skill", label: "Skill", required: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "rateType", label: "Rate type", type: "select", required: true, options: [{ value: "HOURLY", label: "Hourly" }, { value: "FIXED", label: "Fixed / per day" }] },
  { name: "rate", label: "Rate", type: "money", required: true },
  { name: "active", label: "Active", type: "checkbox" },
];

export const expenseFields = (o: { categories: Opt; vendors: Opt; freelancers: Opt; clients: Opt; projects: Opt; deliverables: Opt }): FieldDef[] => [
  { name: "date", label: "Date", type: "date", required: true },
  { name: "amount", label: "Amount", type: "money", required: true, hint: "Use a negative amount for refunds / credits" },
  { name: "description", label: "Description", required: true, full: true },
  { name: "categoryId", label: "Category", type: "select", required: true, options: o.categories },
  { name: "vendorId", label: "Vendor", type: "select", options: o.vendors },
  { name: "projectId", label: "Project (direct cost)", type: "select", options: o.projects, full: true, hint: "Leave blank for overhead" },
  { name: "clientId", label: "Client (if no project)", type: "select", options: o.clients },
  { name: "freelancerId", label: "Freelancer", type: "select", options: o.freelancers },
  { name: "deliverableId", label: "Deliverable", type: "select", options: o.deliverables, full: true },
  { name: "paymentStatus", label: "Payment status", type: "select", required: true, options: [{ value: "PAID", label: "Paid" }, { value: "UNPAID", label: "Unpaid" }] },
  { name: "recurringInterval", label: "Recurring", type: "select", options: [{ value: "MONTHLY", label: "Monthly" }, { value: "QUARTERLY", label: "Quarterly" }, { value: "ANNUAL", label: "Annual" }] },
  { name: "outOfScope", label: "Out-of-scope cost (scope creep)", type: "checkbox", full: true },
];

export const invoiceFields = (clients: Opt, projects: Opt): FieldDef[] => [
  { name: "number", label: "Invoice number", required: true },
  { name: "clientId", label: "Client", type: "select", required: true, options: clients },
  { name: "projectId", label: "Project", type: "select", options: projects, full: true },
  { name: "issueDate", label: "Issue date", type: "date", required: true },
  { name: "dueDate", label: "Due date", type: "date", required: true },
  { name: "subtotal", label: "Fee (ex-tax) — revenue", type: "money", required: true, hint: "Negative for a credit note" },
  { name: "taxAmount", label: "Tax (GST/VAT)", type: "money" },
  { name: "passThrough", label: "Pass-through media spend", type: "money", hint: "Reimbursable — not counted as revenue" },
  { name: "status", label: "Status", type: "select", required: true, options: [{ value: "DRAFT", label: "Draft" }, { value: "SENT", label: "Sent" }, { value: "VOID", label: "Void" }] },
  { name: "description", label: "Description", full: true },
  { name: "sharedWithClient", label: "Visible in client portal", type: "checkbox", full: true },
];

export const scopeFields = (projects: Opt | null, deliverables: Opt): FieldDef[] => [
  ...(projects ? [{ name: "projectId", label: "Project", type: "select", required: true, options: projects, full: true } as FieldDef] : []),
  { name: "title", label: "What was requested", required: true, full: true },
  { name: "type", label: "Type", type: "select", required: true, options: SCOPE_TYPES },
  { name: "deliverableId", label: "Related deliverable", type: "select", options: deliverables },
  { name: "requestedAt", label: "Requested on", type: "date", required: true },
  { name: "requestedBy", label: "Requested by" },
  { name: "estimatedHours", label: "Estimated extra hours", type: "hours" },
  { name: "estimatedCost", label: "Estimated cost to deliver", type: "money" },
  { name: "description", label: "Details", type: "textarea" },
];

export { EXPENSE_KINDS };
