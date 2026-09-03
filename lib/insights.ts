import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealInsightRecord, DealMomentum } from "./types";

// Stored momentum results, so the pipeline health meter can read a number
// instead of making one AI call per open deal on every page load.
//
// This is a cache of the model's current opinion, not a history: one row
// per deal, replaced each time the deal is analysed. Two things write to
// it, and both are worth knowing about:
//
//   1. app/api/insight/route.ts, whenever you press Analyze on an open
//      deal. Looking at a deal therefore keeps the meter current for free.
//   2. refreshPipelineAction, which runs every open deal at once.

const INSIGHT_COLUMNS =
  "id, deal_id, user_id, momentum, reasoning, analyzed_at";

/**
 * Records the latest momentum read for a deal, replacing whatever was
 * there. Upserted on `deal_id`, which carries a unique constraint, so two
 * analyses racing each other leave one row rather than two.
 *
 * Failures here are deliberately swallowed by the callers: a stored copy
 * of an analysis is a convenience for a meter, and losing it should never
 * turn a successful analysis into an error the user sees.
 */
export async function recordDealInsight(
  supabase: SupabaseClient,
  userId: string,
  dealId: string,
  momentum: DealMomentum,
  reasoning: string,
): Promise<void> {
  const { error } = await supabase.from("deal_insights").upsert(
    {
      deal_id: dealId,
      user_id: userId,
      momentum,
      reasoning,
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: "deal_id" },
  );

  if (error) {
    throw new Error(`Failed to store deal insight: ${error.message}`);
  }
}

/**
 * Every stored insight belonging to the signed-in user. Returned whole
 * rather than filtered to open deals: a deal that was analysed and then
 * marked won still has a row, and lib/metrics.ts decides what counts.
 */
export async function listDealInsights(
  supabase: SupabaseClient,
): Promise<DealInsightRecord[]> {
  const { data, error } = await supabase
    .from("deal_insights")
    .select(INSIGHT_COLUMNS);

  if (error) {
    throw new Error(`Failed to load stored insights: ${error.message}`);
  }

  return (data ?? []) as DealInsightRecord[];
}

/**
 * Drops the stored insight for a deal. Called when a deal's notes change
 * enough that the stored read is misleading, or when it is reclassified:
 * "healthy" recorded against a deal you have since marked lost is worse
 * than no reading at all, because the meter would keep counting it.
 */
export async function forgetDealInsight(
  supabase: SupabaseClient,
  dealId: string,
): Promise<void> {
  const { error } = await supabase
    .from("deal_insights")
    .delete()
    .eq("deal_id", dealId);

  if (error) {
    throw new Error(`Failed to clear stored insight: ${error.message}`);
  }
}
