"use client";

import { useActionState, useState } from "react";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { createDealAction, type DealActionState } from "@/app/deals/actions";

const initialState: DealActionState = { error: null };

/**
 * Adds a deal by company name, creating the company if it does not exist.
 *
 * Collapsed by default, like the add-company form. The deals page is now
 * exactly one screen tall, so a permanently open two-field form spends a
 * fixed slice of that screen on something done a few times a week, and
 * takes it from the list you actually came to read.
 *
 * Closing on success also clears it: the inputs unmount, so there is
 * nothing left to reset by hand. A failed submit stays open with what you
 * typed still in it.
 */
export default function NewDealForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createDealAction,
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
        className="mt-4 font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        + add deal
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-4 flex flex-col gap-3 rounded border border-line bg-background/40 p-4"
    >
      <h2 className="font-mono text-sm text-accent2">{"// add a deal"}</h2>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
          Company
          <input
            type="text"
            name="companyName"
            required
            autoFocus
            placeholder="Acme Corp"
            className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
          Deal title
          <input
            type="text"
            name="title"
            required
            placeholder="Q3 renewal"
            className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add deal"}
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
