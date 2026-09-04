"use client";

import { useActionState, useState } from "react";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { createCompanyAction, type FormState } from "@/app/actions";

const initialState: FormState = { error: null };

/**
 * Adds a company with no deal attached, from above the company list.
 *
 * Collapsed by default. The list is the thing you came to this pane to
 * read, and a permanently open form pushes it down the screen for the sake
 * of an action taken once a week.
 */
export default function NewCompanyForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCompanyAction,
    initialState,
  );

  // Closing the form on success also clears it: the inputs unmount with
  // it, so there is nothing left to reset by hand.
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
        + add company
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-1 font-mono text-xs text-muted">
        Company name
        <input
          name="name"
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
