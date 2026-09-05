"use client";

import { useActionState } from "react";
import { toggleNoteConfidentialAction, type FormState } from "@/app/actions";
import type { Note } from "@/lib/types";

const initialState: FormState = { error: null };

/**
 * The badge that says a note is confidential, and the control that flips
 * it. One component rather than two, because the state and the way to
 * change it belong in the same place: a badge you cannot act on makes you
 * hunt for the switch, and a switch with no state makes you guess.
 *
 * Wording is about what the app will do, not about how the note feels.
 * "not sent to the analysis" is checkable; "private" or "secret" is a
 * promise about storage, access and encryption that this does not make and
 * should not imply. The note sits in the same table as every other note
 * and its owner can read it normally. All that changes is that it never
 * reaches a prompt.
 */
export default function ConfidentialToggle({
  note,
  compact = false,
}: {
  note: Note;
  /** Smaller type, for the contact pane's note list. */
  compact?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleNoteConfidentialAction.bind(null, note.id),
    initialState,
  );

  const size = compact ? "text-[11px]" : "text-xs";

  return (
    <form action={formAction} className="contents">
      {/* The value this button is asking for, not the one it is showing. */}
      <input
        type="hidden"
        name="confidential"
        value={note.confidential ? "off" : "on"}
      />
      {note.confidential && (
        <span
          className={`rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono ${size} text-warn`}
          title="Kept out of every analysis and every draft. Still fully visible here."
        >
          confidential
        </span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className={`font-mono ${size} text-dim transition-colors hover:text-accent disabled:opacity-50`}
        title={
          note.confidential
            ? "Let the analysis read this note again"
            : "Keep this out of every analysis and every drafted email"
        }
      >
        {isPending
          ? "saving..."
          : note.confidential
            ? "unmark"
            : "mark confidential"}
      </button>
      {state.error && (
        <span role="alert" className={`font-mono ${size} text-danger`}>
          {state.error}
        </span>
      )}
    </form>
  );
}
