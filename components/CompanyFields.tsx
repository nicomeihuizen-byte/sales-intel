"use client";

import type { FormState } from "@/app/actions";
import MultiField from "@/components/MultiField";
import type { Company } from "@/lib/types";

/**
 * The company form, in one place, used by both the add form on the
 * companies page and the edit panel on both pages.
 *
 * One component rather than two nearly-identical ones, because the two
 * would drift: the day a field is added it lands on the form you were
 * looking at, and the other one keeps quietly saving nulls over it. The
 * contact form already learned this (ContactFields serves add and edit
 * both), and this follows it deliberately.
 *
 * The single-value boxes are uncontrolled (`defaultValue`), so the form
 * itself is the source of truth until submit and there is no render
 * between keystrokes. The socials list is the exception and has to be
 * controlled - see the note in MultiField about what removing a row does
 * to an uncontrolled, index-keyed input.
 */

/** Order is deliberate: who they are, where they are, how you reach them,
 *  what goes on the paperwork. */
const FIELDS = [
  { name: "country", label: "Country", type: "text", key: "country" },
  { name: "phone", label: "Telephone", type: "tel", key: "phone" },
  { name: "email", label: "Email", type: "email", key: "email" },
  { name: "website", label: "Website", type: "text", key: "website" },
  {
    name: "vatNumber",
    label: "VAT number",
    type: "text",
    key: "vat_number",
  },
  {
    name: "registrationNumber",
    label: "Registration number",
    type: "text",
    key: "registration_number",
  },
] as const;

const inputClass =
  "rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent";

export default function CompanyFields({
  formAction,
  state,
  isPending,
  company,
  submitLabel,
  onCancel,
}: {
  formAction: (formData: FormData) => void;
  state: FormState;
  isPending: boolean;
  /** Absent when adding. Present when editing, and every box starts full. */
  company?: Company;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 font-mono text-xs text-muted">
        Company name
        <input
          name="name"
          required
          autoFocus
          defaultValue={company?.name ?? ""}
          className={inputClass}
        />
      </label>

      {/* One box, not four. Nobody types an address a field at a time;
          they paste the block off a website footer or an invoice, and
          this app never sorts on the parts. Country is separate below
          because it is the part that gets used on its own. */}
      <label className="flex flex-col gap-1 font-mono text-xs text-muted">
        Address
        <textarea
          name="address"
          rows={3}
          defaultValue={company?.address ?? ""}
          placeholder="Street, postcode, city"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label
            key={field.name}
            className="flex flex-col gap-1 font-mono text-xs text-muted"
          >
            {field.label}
            <input
              name={field.name}
              type={field.type}
              defaultValue={company?.[field.key] ?? ""}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      {/* A list, and the same component the contact form uses. A company
          has a LinkedIn page and usually an X account, and often the
          founder's GitHub is the one that tells you what they actually
          build. One box named after one network would have been a form
          that argues with you. */}
      <MultiField
        name="socials"
        label="Social"
        type="text"
        values={company?.socials ?? []}
        placeholder="linkedin.com/company/... or x.com/..."
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-sm text-muted hover:text-accent"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
