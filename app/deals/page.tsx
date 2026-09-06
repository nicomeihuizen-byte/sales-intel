import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listDealsForUser } from "@/lib/deals";
import { listDealInsightViews, listStaleOpenDealIds } from "@/lib/insights";
import { autoAnalysisEnabled } from "@/lib/featureFlags";
import {
  EURO,
  STATUS_LABEL,
  STATUS_STYLE,
  MOMENTUM_EDGE,
  MOMENTUM_LABEL,
  MOMENTUM_STYLE,
  formatDealValue,
} from "@/lib/dealDisplay";
import AppNav from "@/components/AppNav";
import AutoAnalyze from "@/components/AutoAnalyze";
import NewDealForm from "@/components/NewDealForm";
import TerminalShell from "@/components/TerminalShell";

// Every deal, across every company. The reference list, in the same shape
// as the companies page: one screen tall, the list scrolling inside it.
//
// The formatter and the two status maps used to be declared here. They now
// live in lib/dealDisplay.ts because the companies page renders deals too,
// and two copies of "what a won deal looks like" is how the two screens
// end up disagreeing about it.

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient();
  const [deals, insights] = await Promise.all([
    listDealsForUser(supabase),
    listDealInsightViews(supabase),
  ]);

  // Dated in the data layer against one clock, never in a component body.
  // See listDealInsightViews and the note on DealInsightView.
  const insightByDeal = new Map(insights.map((view) => [view.dealId, view]));

  const open = deals.filter((deal) => deal.status === "open");

  // Counted only when the flag is on, so a deployment without automatic
  // analysis pays nothing for the question. The action re-derives this for
  // itself; the number here exists so the page can say what is about to
  // happen rather than surprising you with a spinner.
  const staleCount = autoAnalysisEnabled()
    ? (
        await listStaleOpenDealIds(
          supabase,
          open.map((deal) => deal.id),
        )
      ).length
    : 0;

  // Unpriced deals are left out rather than counted as zero, the same way
  // the pipeline strip treats them: nobody has put a number on them yet,
  // which is not the same as them being worth nothing.
  const openValue = open.reduce(
    (total, deal) => total + (deal.value_eur ?? 0),
    0,
  );

  return (
    <TerminalShell
      label="~/deals"
      maxWidthClassName="max-w-[1800px]"
      fillViewport
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-accent">
            Deals
          </h1>
          <p className="mt-1 text-sm text-muted">
            {deals.length} total · {open.length} open · {EURO.format(openValue)}{" "}
            in the open pipeline
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Renders nothing until it has something to say. When the flag
              is off staleCount is 0 and it never starts. */}
          <AutoAnalyze staleCount={staleCount} />
          <AppNav current="deals" />
        </div>
      </div>

      <div className="scroll-pane mt-5 min-h-0 flex-1 overflow-y-auto rounded border border-line">
        {deals.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No deals yet. Add your first one below.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {deals.map((deal) => {
              // Only an open deal carries a momentum reading. The insight
              // route drops the stored row the moment a deal is marked won
              // or lost (see app/api/insight/route.ts), so a closed deal
              // has nothing here by construction, and colouring it green or
              // red would be a claim about work that is already finished.
              const insight =
                deal.status === "open" ? insightByDeal.get(deal.id) : undefined;

              return (
                <li key={deal.id}>
                  <Link
                    href={`/deals/${deal.id}`}
                    className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-background/40 ${
                      insight ? MOMENTUM_EDGE[insight.momentum] : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {deal.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-dim">
                        {deal.company_name}
                      </span>
                      {/* The age sits beside the word, always. A green
                          reading from eleven days ago says a deal is fine
                          when the truth is that nobody has looked since,
                          and a traffic light that is wrong twice is one
                          nobody reads again. */}
                      {deal.status === "open" && (
                        <span className="mt-1 block font-mono text-xs">
                          {insight ? (
                            <>
                              <span
                                className={MOMENTUM_STYLE[insight.momentum]}
                              >
                                {MOMENTUM_LABEL[insight.momentum]}
                              </span>
                              <span className="text-dim"> · {insight.age}</span>
                            </>
                          ) : (
                            <span className="text-dim">not analysed yet</span>
                          )}
                        </span>
                      )}
                    </span>

                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-sm text-muted">
                        {formatDealValue(deal.value_eur)}
                      </span>
                      <span
                        className={`mt-0.5 block font-mono text-xs uppercase ${STATUS_STYLE[deal.status]}`}
                      >
                        {STATUS_LABEL[deal.status]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0">
        <NewDealForm />
      </div>
    </TerminalShell>
  );
}
