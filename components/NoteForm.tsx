"use client";

import { useActionState, useEffect, useRef } from "react";
import { createNoteAction, type NoteActionState } from "@/app/deals/actions";

const initialState: NoteActionState = { error: null };

interface NoteFormProps {
  dealId: string;
}

export default function NoteForm({ dealId }: NoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createNoteAction.bind(null, dealId),
    initialState,
  );

  useEffect(() => {
    if (!isPending && !state.error) {
      formRef.current?.reset();
    }
  }, [isPending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Add a note
        <textarea
          name="content"
          required
          rows={3}
          placeholder="What happened on this deal?"
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
        {isPending ? "Saving..." : "Add note"}
      </button>
    </form>
  );
}
