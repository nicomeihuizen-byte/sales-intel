"use client";

import { useActionState } from "react";
import { toggleProspectAction, type FormState } from "@/app/actions";

const initialState: FormState = { error: null };

/**
 * The pick/drop control on one row of the companies list.
 *
 * When the five slots are full, the unpicked rows render disabled with the
 * reason on them rather than live buttons that fail on click. Telling
 * someone why they cannot do a thing before they try is worth more than an
 * error message afterwards, and this particular limit is the whole point
 * of the feature rather than an obstacle to work around.
 *
 * The server enforces the cap regardless. This is the courtesy, not the
 * control.
 */
export default function ProspectToggle({
  companyId,
  picked,
  slotsFull,
}: {
  companyId: string;
  picked: boolean;
  slotsFull: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleProspectAction,
    initialState,
  );

  const blocked = !picked && slotsFull;

  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="picked" value={picked ? "false" : "true"} />

      {state.error && (
        <span role="alert" className="font-mono text-xs text-red-400">
          {state.error}
        </span>
      )}

      <button
        type="submit"
        disabled={isPending || blocked}
        title={blocked ? "Drop one of your five first." : undefined}
        className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors disabled:cursor-not-allowed ${
          picked
            ? "border-accent-dim bg-accent-dim/20 text-accent hover:border-accent"
            : blocked
              ? "border-line text-dim opacity-50"
              : "border-line text-muted hover:border-accent-dim hover:text-accent"
        }`}
      >
        {isPending ? "..." : picked ? "prospect ✓" : "+ prospect"}
      </button>
    </form>
  );
}
