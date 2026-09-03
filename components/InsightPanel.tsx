"use client";

import { useState } from "react";
import type {
  DealInsight,
  DealLossReview,
  DealMomentum,
  DealStatus,
  DealWinReview,
  LossReviewVerdict,
  WinPattern,
} from "@/lib/types";

interface InsightPanelProps {
  dealId: string;
  dealStatus: DealStatus;
}

// Dark-theme badge colors. Each of the three result types keeps its own
// distinct hue family so a glance at the badge alone tells you which kind
// of read this is, not just what the verdict was - translucent fills and
// bright text read cleanly against the app's dark background, unlike the
// light-mode pastel fills these started as.
const MOMENTUM_STYLES: Record<DealMomentum, string> = {
  healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  stalling: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  at_risk: "bg-red-500/10 text-red-400 border-red-500/30",
};

const MOMENTUM_LABEL: Record<DealMomentum, string> = {
  healthy: "Healthy",
  stalling: "Stalling",
  at_risk: "At risk",
};

const LOSS_REVIEW_STYLES: Record<LossReviewVerdict, string> = {
  confirmed_lost: "bg-white/5 text-muted border-line",
  worth_revisiting: "bg-accent2/10 text-accent2 border-accent2/30",
};

const LOSS_REVIEW_LABEL: Record<LossReviewVerdict, string> = {
  confirmed_lost: "Confirmed lost",
  worth_revisiting: "Worth revisiting",
};

const WIN_REVIEW_STYLES: Record<WinPattern, string> = {
  fast_and_clean: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  steady_and_thorough: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  recovered_momentum:
    "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30",
};

const WIN_REVIEW_LABEL: Record<WinPattern, string> = {
  fast_and_clean: "Fast & clean",
  steady_and_thorough: "Steady & thorough",
  recovered_momentum: "Recovered momentum",
};

// Heading above the action bullets. The loss review is the one case where
// the heading depends on the verdict rather than the mode: on a deal
// that's worth revisiting the items are a re-approach plan, on a
// confirmed loss they're lessons for the next deal, and calling both
// "Recommended actions" would blur two genuinely different lists.
const LOSS_ACTIONS_HEADING: Record<LossReviewVerdict, string> = {
  confirmed_lost: "What to do differently",
  worth_revisiting: "How to revisit",
};

// Per-status copy for the panel. A Record keyed by DealStatus reads more
// clearly here than a chain of status === "x" ? ... : ... ternaries once
// there are three statuses to cover instead of two.
const PANEL_CONFIG: Record<
  DealStatus,
  { title: string; buttonLabel: string; placeholder: string }
> = {
  open: {
    title: "Momentum",
    buttonLabel: "Analyze",
    placeholder:
      "Click Analyze for a reasoned read on this deal's momentum, plus the next steps it points to.",
  },
  lost: {
    title: "Loss review",
    buttonLabel: "Review loss",
    placeholder:
      "Click Review loss to check whether this loss looks final or worth revisiting, and what to do about it.",
  },
  won: {
    title: "Win analysis",
    buttonLabel: "Review win",
    placeholder:
      "Click Review win to see what made this deal work and which plays are worth repeating.",
  },
};

type AnalyzeResult =
  | { mode: "momentum"; insight: DealInsight }
  | { mode: "loss_review"; review: DealLossReview }
  | { mode: "win_review"; review: DealWinReview };

interface AnalyzeResponse {
  mode?: "momentum" | "loss_review" | "win_review";
  insight?: DealInsight;
  review?: DealLossReview | DealWinReview;
  error?: string;
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  return typeof value === "object" && value !== null;
}

/**
 * The advice bullets under an analysis result. Takes the already-validated
 * string array from the API response (lib/ai.ts guarantees one to five
 * non-blank entries, so there is no empty-list state to design for) and a
 * `heading` naming what kind of list it is, since the same component
 * renders next steps, revisit actions and repeatable plays.
 *
 * The heading is a real h3 rather than a styled div: it is the only
 * heading this block has, and it sits under the panel's h2 (see AGENTS.md
 * - Webpage Heading Hierarchy). The bullet marker is a mono ">" instead of
 * list-disc to match the terminal theme, with `list-none` so the browser
 * doesn't render a second marker beside it.
 */
function ActionList({
  heading,
  items,
}: {
  heading: string;
  items: string[];
}) {
  return (
    <div className="mt-4">
      <h3 className="font-mono text-xs uppercase tracking-wide text-muted">
        {heading}
      </h3>
      <ul className="mt-2 list-none space-y-1.5">
        {items.map((item, index) => (
          // The index is part of the key because the list is fixed for the
          // lifetime of a result (nothing reorders or filters it) and two
          // items could in principle come back with identical text, which
          // would collide on text alone.
          <li
            key={`${index}-${item}`}
            className="flex gap-2 text-sm text-foreground"
          >
            <span aria-hidden="true" className="font-mono text-accent">
              {">"}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function parseAnalyzeResult(body: AnalyzeResponse): AnalyzeResult | null {
  if (body.mode === "momentum" && body.insight) {
    return { mode: "momentum", insight: body.insight };
  }

  if (body.mode === "loss_review" && body.review) {
    return { mode: "loss_review", review: body.review as DealLossReview };
  }

  if (body.mode === "win_review" && body.review) {
    return { mode: "win_review", review: body.review as DealWinReview };
  }

  return null;
}

/**
 * Calls POST /api/insight (see app/api/insight/route.ts) for a read on
 * this deal. What question gets asked depends on the deal's own status,
 * since "is this deal stalling" only makes sense for a deal still in play:
 *
 * - open: a momentum read (healthy / stalling / at risk) - the original
 *   Phase 5 feature.
 * - lost: a loss post-mortem instead (confirmed lost / worth revisiting) -
 *   whether the loss was final or left an unexplored angle worth
 *   revisiting later.
 * - won: a win analysis instead (fast & clean / steady & thorough /
 *   recovered momentum) - what made it work and what's repeatable.
 *
 * Whichever question gets asked, the result is a badge, a reasoning
 * paragraph, and an ActionList of two to four bullets. The bullets are
 * the advice half of the product: the reasoning says what is happening,
 * the bullets say what to do about it. Their heading changes per mode
 * ("Next steps", "How to revisit" / "What to do differently", "Worth
 * repeating") because the same generic label over three different kinds
 * of list would hide the difference between them.
 *
 * Fetches on demand rather than on page load, since each call is a real
 * AI request.
 */
export default function InsightPanel({
  dealId,
  dealStatus,
}: InsightPanelProps) {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (!isAnalyzeResponse(body)) {
        setError("Failed to analyze this deal.");
        return;
      }

      const parsed = response.ok ? parseAnalyzeResult(body) : null;

      if (!parsed) {
        setError(body.error ?? "Failed to analyze this deal.");
        return;
      }

      setResult(parsed);
    } catch {
      setError("Failed to reach the analysis service.");
    } finally {
      setIsLoading(false);
    }
  }

  const config = PANEL_CONFIG[dealStatus];

  return (
    <div className="mt-6 rounded border border-line bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm text-accent2">{`// ${config.title}`}</h2>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isLoading}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Analyzing..." : config.buttonLabel}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {result?.mode === "momentum" && (
        <div className="mt-3">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${MOMENTUM_STYLES[result.insight.status]}`}
          >
            {MOMENTUM_LABEL[result.insight.status]}
          </span>
          <p className="mt-2 text-sm text-foreground">
            {result.insight.reasoning}
          </p>
          <ActionList heading="Next steps" items={result.insight.nextSteps} />
        </div>
      )}

      {result?.mode === "loss_review" && (
        <div className="mt-3">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${LOSS_REVIEW_STYLES[result.review.verdict]}`}
          >
            {LOSS_REVIEW_LABEL[result.review.verdict]}
          </span>
          <p className="mt-2 text-sm text-foreground">
            {result.review.reasoning}
          </p>
          <ActionList
            heading={LOSS_ACTIONS_HEADING[result.review.verdict]}
            items={result.review.recommendedActions}
          />
        </div>
      )}

      {result?.mode === "win_review" && (
        <div className="mt-3">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${WIN_REVIEW_STYLES[result.review.pattern]}`}
          >
            {WIN_REVIEW_LABEL[result.review.pattern]}
          </span>
          <p className="mt-2 text-sm text-foreground">
            {result.review.reasoning}
          </p>
          <ActionList
            heading="Worth repeating"
            items={result.review.repeatablePlays}
          />
        </div>
      )}

      {!result && !error && !isLoading && (
        <p className="mt-3 text-sm text-muted">{config.placeholder}</p>
      )}
    </div>
  );
}
