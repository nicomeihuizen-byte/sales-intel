"use client";

import { useActionState, useState } from "react";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { updateNoteAction, type NoteActionState } from "@/app/deals/actions";
import type { Note } from "@/lib/types";

const initialState: NoteActionState = { error: null };

/**
 * True when the note has been edited since it was written. Compared with a
 * one second tolerance because `created_at` is set by Postgres `now()` and
 * `updated_at` by the application clock on insert, so the two are close
 * but rarely identical to the millisecond on a fresh row.
 */
function wasEdited(note: Note): boolean {
  const created = new Date(note.created_at).getTime();
  const updated = new Date(note.updated_at).getTime();

  return updated - created > 1000;
}

function NoteRow({ note }: { note: Note }) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateNoteAction.bind(null, note.id),
    initialState,
  );

  // Close the editor once the action comes back clean, rather than
  // optimistically on submit: a rejected edit then leaves the text you
  // typed on screen instead of discarding it and showing the old version
  // back.
  if (useActionSuccess(state)) {
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <li className="rounded border border-accent-dim px-4 py-3">
        <form action={formAction} className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={`note-${note.id}`}>
            Edit note
          </label>
          <textarea
            id={`note-${note.id}`}
            name="content"
            required
            rows={4}
            defaultValue={note.content}
            className="rounded border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
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
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="font-mono text-sm text-muted hover:text-accent"
            >
              cancel
            </button>
            <span className="ml-auto font-mono text-xs text-dim">
              the date stays as it was
            </span>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group rounded border border-line px-4 py-3">
      <p className="whitespace-pre-wrap text-sm text-foreground">
        {note.content}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <p className="text-xs text-dim">
          {note.kind === "email" && (
            <span className="text-accent2">{"email · "}</span>
          )}
          {new Date(note.created_at).toLocaleString()}
          {wasEdited(note) && (
            <span title={`Edited ${new Date(note.updated_at).toLocaleString()}`}>
              {" · edited"}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="font-mono text-xs text-dim transition-colors hover:text-accent"
        >
          edit
        </button>
      </div>
    </li>
  );
}

/**
 * The note timeline for one deal, with each note editable in place.
 *
 * Notes stay in `created_at` order whatever happens to them, because that
 * ordering is the same thing the AI reads when it reasons about a deal's
 * pace. An edited note keeps its position and gains an "edited" marker, so
 * correcting a typo can never make a deal look more recently active than
 * it is.
 */
export default function NoteList({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">
        No notes yet. Add the first one above.
      </p>
    );
  }

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} />
      ))}
    </ul>
  );
}
