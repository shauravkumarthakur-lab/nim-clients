"use client";
import { ActionButton, ConfirmAction, FormDialog } from "@/components/ui/form-dialog";
import { deleteScopeChange, invoiceScopeChange, quoteScopeChange, setScopeStatus } from "./actions";

export function ScopeActions({ s }: { s: { id: string; status: string; quotedAmount: string | null; estimatedCost: string; sharedWithClient: boolean } }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {["LOGGED", "QUOTED", "REJECTED"].includes(s.status) ? (
        <FormDialog title={s.status === "QUOTED" ? "Revise quotation" : "Create change request"} triggerLabel={s.status === "QUOTED" ? "Revise quote" : "Create quotation"} triggerVariant="secondary" testId="quote-scope"
          description="Prices the extra work as a change request. Share it so the client can approve it in their portal."
          action={quoteScopeChange} fields={[{ name: "id", label: "id", type: "hidden" }, { name: "quotedAmount", label: "Quoted amount (ex-tax)", type: "money", required: true, hint: `Estimated cost to deliver: ${s.estimatedCost}` }, { name: "sharedWithClient", label: "Share with client portal for approval", type: "checkbox", full: true }]}
          defaults={{ id: s.id, quotedAmount: s.quotedAmount ?? "", sharedWithClient: true }} submitLabel="Save quotation" />
      ) : null}
      {s.status === "QUOTED" ? <ActionButton action={setScopeStatus} payload={{ id: s.id, status: "APPROVED" }} testId="approve-scope">Mark approved</ActionButton> : null}
      {s.status === "QUOTED" ? <ActionButton action={setScopeStatus} payload={{ id: s.id, status: "REJECTED" }}>Mark rejected</ActionButton> : null}
      {s.status === "LOGGED" ? <ConfirmAction action={setScopeStatus} payload={{ id: s.id, status: "ABSORBED" }} label="Absorb cost" icon="none" variant="primary" title="Absorb this work?" description="Records that the agency will do this work without charging. The cost stays visible as unrecovered scope creep." confirmLabel="Absorb" /> : null}
      {s.status === "APPROVED" ? <ConfirmAction action={invoiceScopeChange} payload={{ id: s.id }} label="Convert to invoice" icon="none" variant="brand" testId="invoice-scope" title="Create a draft invoice?" description={`Creates a draft invoice for ${s.quotedAmount} (+ tax). Nothing is sent to the client until you mark it sent.`} confirmLabel="Create draft invoice" /> : null}
      {s.status !== "INVOICED" ? <ConfirmAction action={deleteScopeChange} payload={{ id: s.id }} label="Delete" title="Delete this scope entry?" description="Removes it from the scope log." /> : null}
    </div>
  );
}
