"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "./actions";

const initialActionState: AuthActionState = { error: null, message: null };

export default function LoginPage() {
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
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-2xl font-semibold">
        {isSignIn ? "Log in" : "Sign up"}
      </h1>
      <p className="mt-2 text-zinc-500">
        {isSignIn
          ? "Log in to see your deals."
          : "Create an account to start tracking deals."}
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-zinc-700">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            autoComplete={isSignIn ? "current-password" : "new-password"}
            className="rounded border border-zinc-300 px-3 py-2 text-base"
          />
        </label>

        {actionState.error && (
          <p role="alert" className="text-sm text-red-600">
            {actionState.error}
          </p>
        )}
        {actionState.message && (
          <p role="status" className="text-sm text-emerald-600">
            {actionState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Please wait..." : isSignIn ? "Log in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(isSignIn ? "sign-up" : "sign-in")}
        className="mt-4 text-sm text-zinc-500 underline"
      >
        {isSignIn ? "Need an account? Sign up" : "Already have an account? Log in"}
      </button>
    </div>
  );
}
