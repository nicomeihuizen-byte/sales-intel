"use client";

import { useState } from "react";
import Overlay from "@/components/Overlay";
import type { Note } from "@/lib/types";

/**
 * Roughly how much text fits in five lines of a pane this narrow.
 *
 * A guess, and deliberately so. Knowing exactly whether the text overflows
 * means measuring the rendered element, which means an effect, which this
 * repo's lint config treats as an error for the case that would need it.
 * The cost of being wrong is small in both directions: a slightly-too-long
 * note shows "expand" and expands to nearly the same thing, and a note
 * just under the threshold is fully visible and can still be popped out.
 *
 * Explicit newlines are counted properly, because a pasted email is nearly
 * always five short lines rather than one long paragraph, and character
 * count alone would call it short.
 */
const PREVIEW_LINES = 5;
const PREVIEW_CHARS = 260;

function isLong(text: string): boolean {
  return text.length > PREVIEW_CHARS || text.split("\n").length > PREVIEW_LINES;
}

/**
 * How an email announces itself in a list: which way it went, and what it
 * was about.
 *
 * "sent" and "received" rather than an arrow or a colour, because this is
 * the one thing about an email row that must not be inferred. It is also
 * the thing the analysis reads, and a label the reader and the model both
 * see cannot drift apart the way an icon and a column can.
 */
export function noteLabel(note: Note): string | null {
  if (note.kind !== "email") {
    return null;
  }

  return note.direction === "inbound" ? "received" : "sent";
}

/**
 * A note or an email, five lines of it, clickable to see the rest.
 *
 * The body is a button rather than a div with a handler, so it is
 * reachable by keyboard and announces itself as something that does
 * something. Everything else about the row - the date, the edit control,
 * the badges - stays outside it, because a button inside a button is
 * invalid markup and the browser resolves it by picking one, silently.
 *
 * Pasted email bodies are the reason this exists. A full email rendered
 * inline turns the contacts pane into a wall, and the pane's height is the
 * thing that stops the whole desk moving when you click between companies.
 */
export default function NoteBody({
  note,
  className = "text-sm text-foreground",
}: {
  note: Note;
  /** Type styles for the preview, so the two lists can differ in size. */
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const long = isLong(note.content);
  const label = noteLabel(note);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block w-full cursor-pointer text-left"
        aria-label={
          note.subject
            ? `Open the full email: ${note.subject}`
            : "Open the full note"
        }
      >
        {note.subject && (
          <p className="mb-1 truncate font-medium text-foreground">
            {note.subject}
          </p>
        )}
        <p className={`line-clamp-5 whitespace-pre-wrap ${className}`}>
          {note.content}
        </p>
        {long && (
          <span className="mt-1 inline-block font-mono text-[11px] text-dim">
            expand
          </span>
        )}
      </button>

      {isOpen && (
        <Overlay
          label={note.subject ?? "Note"}
          widthClassName="max-w-2xl"
          onClose={() => setIsOpen(false)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {note.subject && (
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {note.subject}
                </h2>
              )}
              <p className="mt-1 font-mono text-xs text-dim">
                {label && <span className="text-accent2">{label} · </span>}
                {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="shrink-0 font-mono text-sm text-dim transition-colors hover:text-accent"
            >
              close
            </button>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {note.content}
          </p>
        </Overlay>
      )}
    </>
  );
}
