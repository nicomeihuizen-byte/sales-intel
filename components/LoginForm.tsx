"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "@/app/login/actions";

const initialActionState: AuthActionState = { error: null, message: null };

/**
 * The log in / sign up form, and the only part of the login page that
 * needs to be a client component.
 *
 * It was the whole page until it caused a hydration failure. `page.tsx`
 * carried `"use client"` at the top and rendered `TerminalShell` inside
 * it, which pulled the shell into the browser bundle. The shell calls
 * `caseStudyLinkEnabled()`, which reads `SHOW_CASE_STUDY_LINK`: a
 * server-only variable, undefined in the browser. So the server, with
 * `SHOW_CASE_STUDY_LINK=false` in `.env.local`, drew no header, and the
 * client, seeing undefined and falling back to the default of on, drew
 * one. Two different trees, one hydration error.
 *
 * It only ever broke locally, because hosted does not set the variable
 * and both sides agreed on "on". A flag whose failure depends on which
 * deployment you are looking at is the worst kind, and this one had the
 * rule against it written into lib/featureFlags.ts already: server-only,
 * never imported from a "use client" file.
 *
 * The state that made the page a client component is here instead: which
 * of the two modes is showing, and the two `useActionState` hooks. The
 * shell stays on the server where it can read the flag.
 */
export default function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [signInState, signInFormAction, signInPending] = useActionState(
    signIn,
    initialActionState,
  );
  const [signUpState, signUpFormAction, signUpPending] = useActionState(
    signUp,
    initialActionState,
  );

  const isSignIn = mode === "sign-in";
  const formAction = isSignIn ? signInFormAction : signUpFormAction;
  const actionState = isSignIn ? signInState : signUpState;
  const isPending = isSignIn ? signInPending : signUpPending;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold text-accent">
        {isSignIn ? "Log in" : "Sign up"}
      </h1>
      <p className="mt-2 text-muted">
        {isSignIn
          ? "Log in to see your deals."
          : "Create an account to start tracking deals."}
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-muted">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            className="rounded border border-line bg-background px-3 py-2 text-base text-foreground outline-none focus:border-accent"
          />
        </label>

        {actionState.error && (
          <p role="alert" className="text-sm text-danger">
            {actionState.error}
          </p>
        )}
        {actionState.message && (
          <p role="status" className="text-sm text-accent">
            {actionState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-4 py-2 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Please wait..." : isSignIn ? "Log in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(isSignIn ? "sign-up" : "sign-in")}
        className="mt-4 font-mono text-sm text-muted underline decoration-line underline-offset-4 hover:text-accent"
      >
        {isSignIn
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </>
  );
}
