"use client";

import { useActionState, useEffect, useRef } from "react";
import { createDealAction, type DealActionState } from "@/app/deals/actions";

const initialState: DealActionState = { error: null };

export default function NewDealForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createDealAction,
    initialState,
  );

  // Clear the form after a successful submit. Uncontrolled inputs don't
  // reset on their own when the server action returns - only when there
  // was no error, so a failed submit keeps what the user typed.
  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
    }
  }, [isPending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 flex flex-col gap-3 rounded border border-line bg-background/40 p-4"
    >
      <h2 className="font-mono text-sm text-accent2">{"// add a deal"}</h2>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Company
        <input
          type="text"
          name="companyName"
          required
          placeholder="Acme Corp"
          className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-muted">
        Deal title
        <input
          type="text"
          name="title"
          required
          placeholder="Q3 renewal"
          className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add deal"}
      </button>
    </form>
  );
}
