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
      className="mt-6 flex flex-col gap-3 rounded border border-zinc-200 p-4"
    >
      <h2 className="text-sm font-medium text-zinc-700">Add a deal</h2>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Company
        <input
          type="text"
          name="companyName"
          required
          placeholder="Acme Corp"
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Deal title
        <input
          type="text"
          name="title"
          required
          placeholder="Q3 renewal"
          className="rounded border border-zinc-300 px-3 py-2 text-base"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add deal"}
      </button>
    </form>
  );
}
