"use client";

import { useState } from "react";
import type { DealInsight, DealMomentum } from "@/lib/types";

interface InsightPanelProps {
  dealId: string;
}

const STATUS_STYLES: Record<DealMomentum, string> = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  stalling: "bg-amber-50 text-amber-700 border-amber-200",
  at_risk: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<DealMomentum, string> = {
  healthy: "Healthy",
  stalling: "Stalling",
  at_risk: "At risk",
};

interface AnalyzeResponse {
  insight?: DealInsight;
  error?: string;
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  return typeof value === "object" && value !== null;
}

/**
 * Calls POST /api/insight (see app/api/insight/route.ts) to get a momentum
 * classification and reasoning for this deal. Fetches on demand rather
 * than on page load, since each call is a real AI request - the build
 * plan's checkpoint is "click Analyze, get a real reasoned status back".
 */
export default function InsightPanel({ dealId }: InsightPanelProps) {
  const [insight, setInsight] = useState<DealInsight | null>(null);
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

      if (!response.ok || !isAnalyzeResponse(body) || !body.insight) {
        const message =
          isAnalyzeResponse(body) && body.error
            ? body.error
            : "Failed to analyze this deal.";
        setError(message);
        return;
      }

      setInsight(body.insight);
    } catch {
      setError("Failed to reach the analysis service.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mt-6 rounded border border-zinc-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700">Momentum</h2>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={isLoading}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {insight && (
        <div className="mt-3">
          <span
            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[insight.status]}`}
          >
            {STATUS_LABEL[insight.status]}
          </span>
          <p className="mt-2 text-sm text-zinc-700">{insight.reasoning}</p>
        </div>
      )}

      {!insight && !error && !isLoading && (
        <p className="mt-3 text-sm text-zinc-500">
          Click Analyze to get a reasoned read on this deal&apos;s momentum.
        </p>
      )}
    </div>
  );
}
