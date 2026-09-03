"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/companies/actions";

const initialState: FormState = { error: null };

/**
 * A two-step delete: the first click swaps the label for a confirmation,
 * the second submits.
 *
 * A `window.confirm` would be one line, but it blocks the page, looks like
 * a browser artefact rather than part of the app, and reads badly on the
 * terminal theme. Two clicks in place cost the same attention and stay
 * inside the design.
 *
 * `hiddenFields` carries the row's id in the form body rather than through
 * a bound argument, matching the other delete action in this app. Either
 * way the id comes from the browser, and RLS plus the server-side feature
 * check are what actually decide whether the delete happens.
 */
export default function ConfirmDeleteButton({
  action,
  hiddenFields,
  label = "remove",
  confirmLabel = "really remove?",
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  hiddenFields: Record<string, string>;
  label?: string;
  confirmLabel?: string;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div>
      {isConfirming ? (
        <form action={formAction} className="flex items-center gap-2">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="submit"
            disabled={isPending}
            className="font-mono text-xs text-red-400 transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {isPending ? "removing..." : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="font-mono text-xs text-dim hover:text-accent"
          >
            no
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="font-mono text-xs text-dim transition-colors hover:text-red-400"
        >
          {label}
        </button>
      )}

      {/* Rendered outside the branch so a refusal (an unemptied company,
          or the feature being off) stays visible whichever state the
          button is in when the answer comes back. */}
      {state.error && (
        <p role="alert" className="mt-1 text-xs text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}
