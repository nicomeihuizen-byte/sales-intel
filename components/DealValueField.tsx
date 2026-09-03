"use client";

import { useActionState, useState } from "react";
import {
  updateDealValueAction,
  type FormState,
} from "@/app/companies/actions";
import { useActionSuccess } from "@/lib/useActionSuccess";
import { formatEuro } from "@/lib/metrics";

const initialState: FormState = { error: null };

/**
 * The euro value on a deal row: a figure you click to edit, not a
 * permanent input box. Most of the time this is something to read, and a
 * row of live text fields makes a deal list look like a spreadsheet.
 *
 * An unpriced deal shows a dash rather than "€0". Nothing has been decided
 * about its value, and zero is a decision.
 */
export default function DealValueField({
  dealId,
  valueEur,
}: {
  dealId: string;
  valueEur: number | null;
}) {
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
        title="Set the deal value"
        className={`shrink-0 font-mono text-xs transition-colors hover:text-accent ${
          valueEur === null ? "text-dim" : "text-muted"
        }`}
      >
        {valueEur === null ? "€ —" : formatEuro(valueEur)}
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
        defaultValue={valueEur === null ? "" : String(valueEur)}
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
