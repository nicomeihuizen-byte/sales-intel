"use client";

import { useActionState, useState } from "react";
import {
  updateDealValueAction,
  type FormState,
} from "@/app/actions";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { formatEuro } from "@/lib/metrics";

const initialState: FormState = { error: null };

/**
 * The euro value on a deal row: a figure you click to edit, not a
 * permanent input box. Most of the time this is something to read, and a
 * row of live text fields makes a deal list look like a spreadsheet.
 *
 * An unpriced deal shows "+ value", not "€ —". The dash was honest about
 * the data and useless as an interface: it reads as a blank, so nothing
 * suggests it can be clicked, and the way to price a deal was invisible.
 * Zero is still never shown for an unpriced deal, because zero is a
 * decision and no decision has been made.
 */
export default function DealValueField({
  dealId,
  valueEur,
}: {
  dealId: string;
  valueEur: number | null;
}) {
  // A value that isn't a finite number is treated as unpriced. The bug
  // that made this necessary was a query missing the column, so the field
  // arrived undefined and NaN reached the formatter. Fixed at the source
  // in lib/companies.ts, but a missing column should show a dash, not
  // "\u20ac NaN", if it ever happens again.
  const value = Number.isFinite(valueEur as number) ? valueEur : null;
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateDealValueAction.bind(null, dealId),
    initialState,
  );

  if (useActionSuccess(state)) {
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        title={value === null ? "Add a deal value" : "Change the deal value"}
        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs transition-colors hover:bg-white/5 hover:text-accent ${
          value === null ? "text-dim" : "text-muted"
        }`}
      >
        {value === null ? "+ value" : formatEuro(value)}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-1">
      <label className="sr-only" htmlFor={`value-${dealId}`}>
        Deal value in euros
      </label>
      <input
        id={`value-${dealId}`}
        name="valueEur"
        inputMode="decimal"
        autoFocus
        defaultValue={value === null ? "" : String(value)}
        placeholder="12.500"
        className="w-24 rounded border border-line bg-background px-2 py-1 font-mono text-xs text-foreground outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={isPending}
        className="font-mono text-xs text-accent transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {isPending ? "..." : "ok"}
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(false)}
        className="font-mono text-xs text-dim hover:text-accent"
      >
        x
      </button>
      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
