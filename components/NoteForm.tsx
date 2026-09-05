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
      <label className="flex flex-col gap-1 text-sm text-muted">
        Add a note
        <textarea
          name="content"
          required
          rows={3}
          placeholder="What happened on this deal?"
          className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Add note"}
      </button>
    </form>
  );
}
