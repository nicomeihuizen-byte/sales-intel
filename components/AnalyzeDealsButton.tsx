"use client";

import { useActionState } from "react";
import { analyzeCompanyDealsAction, type RefreshState } from "@/app/actions";

const initialState: RefreshState = { error: null, analyzed: 0, failed: 0 };

/**
 * Re-runs the analysis for the open deals at the selected company, from
 * above the deals list.
 *
 * Scoped to the company on purpose. The pipeline strip already has a
 * control that covers everything, and a second one doing the same thing in
 * a different place would be worse than one. This answers the question you
 * have while looking at a company, and costs a handful of model calls
 * rather than all of them.
 *
 * "Analyze deals", plural, and it took two goes to get right. It was
 * briefly "Analyze company", which was true of the action and wrong on the
 * screen: this button sits in the `// deals` pane header, above the list it
 * acts on, so a label naming the company read as though it did something
 * else entirely.
 *
 * The label names what is under it, not what the function is scoped by.
 * Three Analyze controls now sit at three levels and each one is named for
 * the thing it is standing on:
 *
 *   Analyze deal     one deal, from inside it   (components/InsightPanel)
 *   Analyze deals    the deals in this pane     (this file)
 *   Analyze pipeline every open deal you own    (components/PipelineMeters)
 *
 * The singular and the plural differ by one letter, which would be a bad
 * distinction if they were ever visible together. They are not: "Analyze
 * deal" only exists inside the deal overlay, which covers this pane while
 * it is open.
 *
 * Green, and deliberately not the red of the pipeline button. Both spend
 * money and one spends far more of it, so the colours say which is which
 * before the words are read.
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
        <p role="alert" className="text-xs text-danger">
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
          {isPending ? "Analysing..." : "Analyze deals"}
        </button>
      </form>
    </div>
  );
}
