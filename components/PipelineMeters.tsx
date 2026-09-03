"use client";

import { useActionState, useState } from "react";
import {
  refreshPipelineAction,
  type RefreshState,
} from "@/app/companies/actions";
import { formatEuro } from "@/lib/metrics";
import type { PipelineMetrics } from "@/lib/types";

const initialRefreshState: RefreshState = {
  error: null,
  analyzed: 0,
  failed: 0,
};

/**
 * Status colours for the health meter, validated against this app's dark
 * surface: chroma, contrast, CVD separation and normal-vision separation
 * all pass. They deliberately sit outside the "categorical lightness band"
 * a palette checker wants, because these are status colours shown one at a
 * time, not series that have to look equally weighted side by side.
 *
 * Status is never carried by colour alone here: the meter always shows the
 * number and the word next to the bar.
 */
const HEALTH_BANDS = [
  { floor: 75, label: "Healthy", fill: "#10b981", text: "text-[#10b981]" },
  { floor: 45, label: "Slowing", fill: "#f59e0b", text: "text-[#f59e0b]" },
  { floor: 0, label: "At risk", fill: "#ef4444", text: "text-[#ef4444]" },
] as const;

function bandFor(score: number) {
  return HEALTH_BANDS.find((band) => score >= band.floor) ?? HEALTH_BANDS[2];
}

function daysSince(iso: string): number {
  return Math.floor(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * The health meter: a single ratio against a limit, which is the one thing
 * in this panel that is genuinely a chart.
 *
 * A horizontal track rather than the semicircular gauges of the mockup. At
 * this size an arc spends most of its pixels on the arc and leaves the
 * number small, and a semicircle implies a scale with meaningful zones
 * that a 0-100 average of three classifications does not have.
 */
function HealthMeter({ metrics }: { metrics: PipelineMetrics }) {
  const { healthScore, analyzedDeals, openDeals, oldestAnalysisAt } = metrics;

  if (healthScore === null) {
    return (
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-dim">
          Pipeline health
        </p>
        <p className="mt-1 text-sm text-muted">
          {openDeals === 0
            ? "No open deals."
            : `${openDeals} open deal${openDeals === 1 ? "" : "s"}, none analysed yet.`}
        </p>
      </div>
    );
  }

  const band = bandFor(healthScore);
  const staleDays = oldestAnalysisAt ? daysSince(oldestAnalysisAt) : 0;

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-dim">
        Pipeline health
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-foreground">
          {healthScore}
        </span>
        <span className={`font-mono text-xs uppercase ${band.text}`}>
          {band.label}
        </span>
      </div>

      {/* 6px track, 4px rounded ends, fill anchored at the left baseline. */}
      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded bg-white/10"
        role="meter"
        aria-valuenow={healthScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Pipeline health ${healthScore} out of 100, ${band.label}`}
      >
        <div
          className="h-full rounded"
          style={{ width: `${healthScore}%`, backgroundColor: band.fill }}
        />
      </div>

      <p className="mt-1.5 font-mono text-[11px] text-dim">
        {analyzedDeals} of {openDeals} analysed
        {oldestAnalysisAt && staleDays > 0 && ` · oldest ${staleDays}d`}
      </p>
    </div>
  );
}

/**
 * A headline number. Not a gauge: three of the four figures asked for
 * (open value, won value, months to win) have no ceiling to be a ratio
 * against, and a gauge without a meaningful maximum has to invent one.
 * Inventing a scale is inventing information, so these stay as figures.
 */
function StatTile({
  label,
  value,
  footnote,
}: {
  label: string;
  value: string;
  footnote?: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-wide text-dim">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground">
        {value}
      </p>
      {footnote && (
        <p className="mt-0.5 font-mono text-[11px] text-dim">{footnote}</p>
      )}
    </div>
  );
}

/**
 * The fixed metrics panel: one meter and three figures, bottom right.
 *
 * Collapsible, because a fixed panel is in the way the moment you stop
 * looking at it, and this one sits over the notes timeline.
 */
export default function PipelineMeters({
  metrics,
}: {
  metrics: PipelineMetrics;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [state, refreshAction, isRefreshing] = useActionState(
    refreshPipelineAction,
    initialRefreshState,
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-20 rounded-lg border border-line bg-raised/90 px-3 py-2 font-mono text-xs text-muted shadow-lg backdrop-blur transition-colors hover:text-accent"
      >
        {"// pipeline"}
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 right-4 z-20 w-[19rem] rounded-lg border border-line bg-raised/90 p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm text-accent2">{"// pipeline"}</h2>
        <div className="flex items-center gap-3">
          <form action={refreshAction}>
            <button
              type="submit"
              disabled={isRefreshing}
              className="font-mono text-xs text-dim transition-colors hover:text-accent disabled:opacity-50"
            >
              {isRefreshing ? "analysing..." : "refresh"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="font-mono text-xs text-dim transition-colors hover:text-accent"
            aria-label="Hide the pipeline panel"
          >
            hide
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <HealthMeter metrics={metrics} />

        <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
          <StatTile
            label="Open"
            value={formatEuro(metrics.openValueEur)}
            footnote={`${metrics.openDeals} deal${metrics.openDeals === 1 ? "" : "s"}`}
          />
          <StatTile label="Won" value={formatEuro(metrics.wonValueEur)} />
        </div>

        <div className="border-t border-line pt-4">
          <StatTile
            label="Open to won"
            value={
              metrics.averageMonthsToWin === null
                ? "not enough data"
                : `${metrics.averageMonthsToWin} months`
            }
            footnote={
              metrics.wonDealsWithDates > 0
                ? `average of ${metrics.wonDealsWithDates} deal${metrics.wonDealsWithDates === 1 ? "" : "s"}`
                : "counts deals closed in this app"
            }
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {state.error}
        </p>
      )}
      {!state.error && state.analyzed > 0 && (
        <p className="mt-3 font-mono text-[11px] text-dim">
          {state.analyzed} deal{state.analyzed === 1 ? "" : "s"} re-analysed.
        </p>
      )}
    </aside>
  );
}
