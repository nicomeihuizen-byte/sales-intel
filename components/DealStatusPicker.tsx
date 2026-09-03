"use client";

import { useActionState } from "react";
import {
  updateDealStatusAction,
  type DealStatusActionState,
} from "@/app/deals/actions";
import { DEAL_STATUSES } from "@/lib/deals";
import type { DealStatus } from "@/lib/types";

const initialState: DealStatusActionState = { error: null };

const STATUS_LABEL: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

// Matches the momentum/win/loss badge families in InsightPanel, so a deal
// marked won reads as the same colour here as the analysis it will get.
const STATUS_STYLE: Record<DealStatus, string> = {
  open: "text-accent",
  won: "text-violet-400",
  lost: "text-muted",
};

/**
 * Inline status picker for one deal. Submits on change rather than behind
 * a Save button: there is one field and three values, so a second click to
 * confirm buys nothing.
 *
 * Deliberately not a link or a button inside the deal's own link. Nesting
 * an interactive control inside an anchor is invalid HTML and the two
 * fight over the click, so the deal row puts the link and this side by
 * side instead, which also means you can reclassify a deal without opening
 * it.
 */
export default function DealStatusPicker({
  dealId,
  status,
}: {
  dealId: string;
  status: DealStatus;
}) {
  const [state, formAction, isPending] = useActionState(
    updateDealStatusAction.bind(null, dealId),
    initialState,
  );

  return (
    <form action={formAction} className="shrink-0">
      <label className="sr-only" htmlFor={`status-${dealId}`}>
        Deal status
      </label>
      <select
        id={`status-${dealId}`}
        name="status"
        defaultValue={status}
        disabled={isPending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={`cursor-pointer rounded border border-line bg-background px-2 py-1 font-mono text-xs uppercase outline-none transition-colors hover:border-accent-dim focus:border-accent disabled:opacity-50 ${STATUS_STYLE[status]}`}
      >
        {DEAL_STATUSES.map((value) => (
          <option key={value} value={value} className="text-foreground">
            {STATUS_LABEL[value]}
          </option>
        ))}
      </select>

      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
