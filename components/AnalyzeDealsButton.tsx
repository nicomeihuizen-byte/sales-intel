"use client";

import { useActionState } from "react";
import {
  analyzeCompanyDealsAction,
  type RefreshState,
} from "@/app/companies/actions";

const initialState: RefreshState = { error: null, analyzed: 0, failed: 0 };

/**
 * Re-runs the analysis for the open deals at the selected company, from
 * above the deals list.
 *
 * Scoped to the company on purpose. The pipeline strip already has a
 * refresh that covers everything, and a second control doing the same
 * thing in a different place would be worse than one. This one answers
 * the question you have while looking at a company, and costs a handful
 * of model calls rather than all of them.
 */
export default function AnalyzeDealsButton({
  companyId,
}: {
  companyId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    analyzeCompanyDealsAction.bind(null, companyId),
    initialState,
  );

  return (
    <div className="flex items-center gap-3">
      {state.error && (
        <p role="alert" className="text-xs text-red-400">
          {state.error}
        </p>
      )}
      {!state.error && state.analyzed > 0 && (
        <p className="font-mono text-[11px] text-dim">
          {state.analyzed} analysed
        </p>
      )}
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-3 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Analysing..." : "Analyze"}
        </button>
      </form>
    </div>
  );
}
