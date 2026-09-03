"use client";

import { useActionState, useState } from "react";
import {
  createDealForCompanyAction,
  type FormState,
} from "@/app/companies/actions";
import { useActionSuccess } from "@/lib/useActionSuccess";

const initialState: FormState = { error: null };

/**
 * Adds a deal to the company you already have selected.
 *
 * The point of it is the field that isn't here. The form on /deals asks
 * for a company NAME and finds-or-creates by that name, so one typo makes
 * a second company holding one orphaned deal, with nothing on screen to
 * say so. Here the company is the one in the left pane, so that outcome
 * cannot happen.
 */
export default function NewDealInCompanyForm({
  companyId,
}: {
  companyId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createDealForCompanyAction.bind(null, companyId),
    initialState,
  );

  if (useActionSuccess(state)) {
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        + add deal
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1 font-mono text-xs text-muted">
        Deal title
        <input
          name="title"
          required
          autoFocus
          className="rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="font-mono text-sm text-muted hover:text-accent"
        >
          cancel
        </button>
      </div>
    </form>
  );
}
