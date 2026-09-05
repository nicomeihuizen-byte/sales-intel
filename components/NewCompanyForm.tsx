"use client";

import { useActionState, useState } from "react";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { createCompanyAction, type FormState } from "@/app/actions";
import CompanyFields from "@/components/CompanyFields";
import Overlay from "@/components/Overlay";

const initialState: FormState = { error: null };

/**
 * Adds a company, from below the company list.
 *
 * In an overlay rather than expanding in place, which is what it did while
 * it was a single name box. Nine fields unfolding at the bottom of the
 * page would either push the list off the screen or make the page scroll
 * while you type, and the list is the thing you came here to read.
 *
 * Only the name is required. The rest of the form is there because the
 * moment you first add a company is usually the moment you have the
 * address and the VAT number in front of you, and making that a second
 * trip through an edit panel is how a record ends up never being filled
 * in at all.
 */
export default function NewCompanyForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCompanyAction,
    initialState,
  );

  // Closing on success also clears it: the inputs unmount with the
  // overlay, so there is nothing left to reset by hand.
  if (useActionSuccess(state)) {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        + add company
      </button>

      {isOpen && (
        <Overlay
          label="Add a company"
          onClose={() => setIsOpen(false)}
          widthClassName="max-w-2xl"
        >
          <h3 className="font-display text-lg font-semibold text-foreground">
            Add a company
          </h3>
          <p className="mt-1 text-sm text-muted">
            The name is all that is required. The rest can wait until you have
            it.
          </p>

          <div className="mt-4">
            <CompanyFields
              formAction={formAction}
              state={state}
              isPending={isPending}
              submitLabel="Add"
              onCancel={() => setIsOpen(false)}
            />
          </div>
        </Overlay>
      )}
    </>
  );
}
