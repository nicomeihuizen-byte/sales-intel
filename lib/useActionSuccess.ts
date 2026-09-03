"use client";

import { useState } from "react";

/**
 * Detects the moment a `useActionState` action finishes without an error.
 *
 * `useActionState` hands back a new state object each time the action
 * resolves, so comparing it by identity with the one this component last
 * saw tells you a submission just completed. Returns true on exactly the
 * render after a successful submit, and false on every other render.
 *
 * The obvious implementation is a useEffect that calls setState, which is
 * what this replaces: React 19's react-hooks/set-state-in-effect rejects
 * that, because a setState inside an effect causes a second render pass
 * the framework can't batch. Adjusting state during render instead is the
 * pattern React documents for exactly this case ("you might not need an
 * effect"), and it settles before the browser ever paints.
 *
 * Usage, with the open/closed state owned by the same component that calls
 * useActionState:
 *
 *   const [state, formAction, isPending] = useActionState(action, initial);
 *   if (useActionSuccess(state)) {
 *     setIsEditing(false);
 *   }
 */
export function useActionSuccess<T extends { error: string | null }>(
  state: T,
): boolean {
  const [seenState, setSeenState] = useState<T>(state);

  if (state !== seenState) {
    setSeenState(state);
    return state.error === null;
  }

  return false;
}
