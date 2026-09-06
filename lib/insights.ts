import type { SupabaseClient } from "@supabase/supabase-js";
import { toInsightViews, type DealInsightView } from "./dealDisplay";
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
 * The stored insights, already dated, ready for a list to draw.
 *
 * The clock lives here rather than in the page, for two reasons. Reading
 * `Date.now()` in a component body is an impurity the React Compiler lint
 * refuses (`react-hooks/purity`), and it is right to: a component that
 * reads the clock renders differently every time it runs. Doing it in the
 * data layer also means every page dates its whole list against one
 * instant instead of one per row.
 */
export async function listDealInsightViews(
  supabase: SupabaseClient,
): Promise<DealInsightView[]> {
  const records = await listDealInsights(supabase);
  return toInsightViews(records, Date.now());
}

/**
 * The open deals whose stored reading no longer describes their notes.
 *
 * This is the whole reason the deals page can refresh itself without
 * costing a call per deal per visit. A deal is stale when:
 *
 * 1. **It has notes that the model may read.** A deal with nothing on it,
 *    or one where every note is confidential, has nothing to reason from,
 *    so analysing it buys a paid call and a verdict about silence.
 * 2. **And either it has never been analysed, or a note has changed since
 *    it was.** `notes.updated_at` and not `created_at`, so editing a note
 *    counts: the analysis reads the current text, not the text as first
 *    typed.
 *
 * Everything else is already correct and is left alone. On an ordinary
 * evening this returns nothing, or the one deal a note was just added to.
 *
 * **`confidential = false`, matching listNotesForAnalysis exactly.** A
 * confidential note is not an input to the analysis, so it must not be a
 * reason to re-run it. That filter appearing in two places is the risk
 * this project has a rule about, so if listNotesForAnalysis ever changes
 * what it excludes, this changes with it.
 *
 * Two queries, not one per deal. `deal_id, updated_at` over the user's own
 * notes is a narrow read that RLS already scopes, and the newest per deal
 * is picked here rather than in SQL because PostgREST has no clean
 * "greatest per group" and the row count is small.
 */
export async function listStaleOpenDealIds(
  supabase: SupabaseClient,
  openDealIds: string[],
): Promise<string[]> {
  if (openDealIds.length === 0) {
    return [];
  }

  const [noteRows, insightRecords] = await Promise.all([
    supabase
      .from("notes")
      .select("deal_id, updated_at")
      .eq("confidential", false)
      .in("deal_id", openDealIds),
    listDealInsights(supabase),
  ]);

  if (noteRows.error) {
    throw new Error(
      `Failed to load note timestamps: ${noteRows.error.message}`,
    );
  }

  const newestNoteAt = new Map<string, number>();

  for (const row of (noteRows.data ?? []) as {
    deal_id: string | null;
    updated_at: string;
  }[]) {
    if (!row.deal_id) {
      continue;
    }

    const at = new Date(row.updated_at).getTime();
    const held = newestNoteAt.get(row.deal_id);

    if (held === undefined || at > held) {
      newestNoteAt.set(row.deal_id, at);
    }
  }

  const analyzedAt = new Map(
    insightRecords.map((record) => [
      record.deal_id,
      new Date(record.analyzed_at).getTime(),
    ]),
  );

  return openDealIds.filter((dealId) => {
    const noteAt = newestNoteAt.get(dealId);

    if (noteAt === undefined) {
      return false;
    }

    const readAt = analyzedAt.get(dealId);
    return readAt === undefined || noteAt > readAt;
  });
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
