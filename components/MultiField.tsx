"use client";

import { useState } from "react";

/**
 * A field that holds several values: emails, phone numbers, socials.
 *
 * Lifted out of ContactList because the company form needs the same thing,
 * and because it needed two changes that were worth making once rather
 * than twice.
 *
 * **It is controlled now, and that is not a style preference.** The
 * previous version kept the rows in state but left the inputs
 * uncontrolled, with `defaultValue` and an index key. That works while
 * rows are only ever appended, and breaks the moment one can be removed:
 * splicing the middle row out of state renders one fewer input, but the
 * surviving inputs keep the DOM values they already had, so deleting the
 * second of three appears to delete the third. The value would have been
 * wrong on screen and right in the database, or the other way round, and
 * either is the kind of bug you only catch by noticing an address you
 * deleted is still there tomorrow. Holding the values in state is what
 * makes remove mean what it says.
 *
 * **Every row has a remove control.** Blank rows are still dropped on the
 * server, so clearing a box has always worked - but nothing on screen said
 * so, which made this an add-only form in practice. An × is the thing you
 * look for.
 *
 * No spare trailing row any more. With an explicit "+ another" the spare
 * was a second way to do the same thing, and an empty row carrying a
 * remove button reads as a mistake.
 */
export default function MultiField({
  name,
  label,
  type,
  values,
  placeholder,
}: {
  /** The form field name. Every row shares it; the action reads getAll. */
  name: string;
  label: string;
  type: string;
  values: string[];
  placeholder?: string;
}) {
  // One empty row when there is nothing yet, so there is always somewhere
  // to type without pressing anything first.
  const [rows, setRows] = useState<string[]>(
    values.length > 0 ? [...values] : [""],
  );

  function setRow(index: number, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? value : row)),
    );
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, i) => i !== index);
      // Never zero rows: removing the last one empties it instead, so the
      // field does not vanish off the form and leave no way back.
      return next.length > 0 ? next : [""];
    });
  }

  const singular = label.toLowerCase();

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs text-muted">{label}</span>

      {rows.map((value, index) => (
        // Index-keyed because the list is positional: a row's identity here
        // is "the nth box". Safe now in a way it was not before, because
        // the inputs are controlled - the value comes from state on every
        // render rather than from whatever the DOM happens to be holding.
        <div key={`${name}-${index}`} className="flex items-center gap-1.5">
          <input
            name={name}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setRow(index, event.target.value)}
            aria-label={`${label} ${index + 1}`}
            className="min-w-0 flex-1 rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => removeRow(index)}
            aria-label={`Remove ${singular} ${index + 1}`}
            title={`Remove this ${singular}`}
            className="shrink-0 rounded px-1.5 py-1 font-mono text-xs text-dim transition-colors hover:text-danger"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setRows((current) => [...current, ""])}
        className="self-start font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        {`+ another ${singular}`}
      </button>
    </div>
  );
}
