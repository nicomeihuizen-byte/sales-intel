import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Deal,
  DealInsightRecord,
  DealMomentum,
  PipelineMetrics,
} from "./types";
import { listDealInsights } from "./insights";
import { DEAL_COLUMNS } from "./deals";

// The four numbers behind the metrics panel. All derived, none stored.

/**
 * What each momentum classification is worth on a 0-100 scale.
 *
 * These are a judgement, not a measurement, and the spacing is the
 * judgement: stalling sits at 55 rather than halfway, because a stalling
 * deal is much closer to recoverable than to dead, and at_risk sits at 15
 * rather than 0 because "no plausible next step in the current approach"
 * is not the same as lost. A pipeline of nothing but at-risk deals should
 * read as nearly empty, and it does.
 */
const MOMENTUM_SCORE: Record<DealMomentum, number> = {
  healthy: 100,
  stalling: 55,
  at_risk: 15,
};

/**
 * Averages the stored momentum reads across the open deals that have one.
 *
 * Deliberately averages only the deals that HAVE been analysed, rather
 * than treating an unanalysed deal as a zero. An unanalysed deal is an
 * unknown, and folding unknowns in as bad news would make the meter drop
 * every time you add a deal. The panel shows "n of m analysed" beside the
 * score so the coverage is visible rather than implied.
 */
function scoreFromInsights(
  openDeals: Deal[],
  insights: DealInsightRecord[],
): { score: number | null; analyzed: number; oldestAnalysisAt: string | null } {
  const openDealIds = new Set(openDeals.map((deal) => deal.id));
  const relevant = insights.filter((insight) =>
    openDealIds.has(insight.deal_id),
  );

  if (relevant.length === 0) {
    return { score: null, analyzed: 0, oldestAnalysisAt: null };
  }

  const total = relevant.reduce(
    (sum, insight) => sum + (MOMENTUM_SCORE[insight.momentum] ?? 0),
    0,
  );

  const oldest = relevant.reduce((earliest, insight) =>
    insight.analyzed_at < earliest.analyzed_at ? insight : earliest,
  );

  return {
    score: Math.round(total / relevant.length),
    analyzed: relevant.length,
    oldestAnalysisAt: oldest.analyzed_at,
  };
}

/**
 * Sums euro values, skipping the nulls. A deal nobody has priced is not
 * worth zero, it is unknown, and adding it as zero would understate the
 * pipeline while looking like a complete figure.
 */
function sumValues(deals: Deal[]): number {
  return deals.reduce((total, deal) => total + (deal.value_eur ?? 0), 0);
}

/**
 * The share of closed deals that were won.
 *
 * This replaced an average time from open to won, and the reason is worth
 * keeping. That metric needed both a `created_at` and a `closed_at` on the
 * same won deal, so it read "not enough data" on any pipeline where nothing
 * had yet been closed inside this app, which is every new account and was
 * still true of his own after a week. A panel tile that says nothing for
 * the first month is a tile nobody looks at afterwards.
 *
 * Won over won-plus-lost, so open deals do not drag it down: a deal still
 * in play has not been lost, and counting it as one would make a healthy
 * pipeline look like a bad quarter.
 *
 * Null when nothing has closed at all. That is a different statement from
 * 0%, which means deals closed and none of them were won, and the panel
 * says so in different words.
 */
function winRateFromDeals(deals: Deal[]): {
  rate: number | null;
  won: number;
  lost: number;
} {
  const won = deals.filter((deal) => deal.status === "won").length;
  const lost = deals.filter((deal) => deal.status === "lost").length;
  const closed = won + lost;

  if (closed === 0) {
    return { rate: null, won, lost };
  }

  return { rate: Math.round((won / closed) * 100), won, lost };
}

/**
 * Computes the whole panel from two queries: every deal the user owns, and
 * every stored insight. Both are small (one row per deal), so this is
 * cheaper than it looks and involves no AI call at all - that is the whole
 * point of storing the analyses.
 */
export async function computePipelineMetrics(
  supabase: SupabaseClient,
  /**
   * Already-loaded insights, when the caller has them.
   *
   * The desk needs the same rows to render its deal summaries, so fetching
   * them here as well meant the page issued the identical query twice, one
   * after the other. Passing them in removes a whole round trip from a page
   * that had far too many.
   */
  knownInsights?: DealInsightRecord[],
): Promise<PipelineMetrics> {
  const { data, error } = await supabase.from("deals").select(DEAL_COLUMNS);

  if (error) {
    throw new Error(`Failed to load deals for metrics: ${error.message}`);
  }

  const deals = (data ?? []) as Deal[];
  const insights = knownInsights ?? (await listDealInsights(supabase));

  const openDeals = deals.filter((deal) => deal.status === "open");
  const wonDeals = deals.filter((deal) => deal.status === "won");
  const { score, analyzed, oldestAnalysisAt } = scoreFromInsights(
    openDeals,
    insights,
  );
  const { rate, lost } = winRateFromDeals(deals);

  return {
    healthScore: score,
    analyzedDeals: analyzed,
    openDeals: openDeals.length,
    openValueEur: sumValues(openDeals),
    wonDeals: wonDeals.length,
    wonValueEur: sumValues(wonDeals),
    winRate: rate,
    lostDeals: lost,
    oldestAnalysisAt,
  };
}

/**
 * Euros, no decimals, grouped the Dutch way (12.500). Fixed to nl-NL
 * rather than the visitor's locale so the same figure reads identically
 * for him and for anyone he shows it to.
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}
