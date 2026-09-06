import type { DealInsightRecord, DealMomentum, DealStatus } from "./types";

/**
 * How a deal is rendered, in one place.
 *
 * The euro formatter and the two status maps were written out inside
 * app/deals/page.tsx, and the companies page now needs the same three. A
 * second copy is how this project produced "€ NaN" (see DEAL_COLUMNS) and
 * how it nearly ended up with two find-or-create functions for parents.
 * The rule it keeps rediscovering is the same one: the moment a thing is
 * needed twice, it moves.
 *
 * `nl-NL` and no decimals, because every value in this app is a whole
 * euro amount typed by a Dutch speaker.
 */
export const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export const STATUS_LABEL: Record<DealStatus, string> = {
  open: "open",
  won: "won",
  lost: "lost",
};

export const STATUS_STYLE: Record<DealStatus, string> = {
  open: "text-accent2",
  won: "text-ok",
  lost: "text-dim",
};

/**
 * What one deal's value looks like on screen.
 *
 * An en dash for null, never "€ 0". Nobody having put a number on a deal
 * yet is a different fact from the deal being worth nothing, and the
 * pipeline totals already treat them differently: an unpriced deal is
 * skipped, not added as zero.
 */
export function formatDealValue(valueEur: number | null): string {
  return valueEur === null ? "–" : EURO.format(valueEur);
}

/**
 * The three momentum readings, in words and in colour.
 *
 * `at_risk` is stored with an underscore because it is a database value;
 * nobody says "at underscore risk", so the label carries the space and the
 * column keeps the identifier.
 *
 * The colours are the same three the pipeline meter already uses, and they
 * are deliberately the traffic-light set: this is a judgement about where
 * the evening should go, and it has to be readable without being read.
 */
export const MOMENTUM_LABEL: Record<DealMomentum, string> = {
  healthy: "healthy",
  stalling: "stalling",
  at_risk: "at risk",
};

/**
 * The momentum word in a list.
 *
 * Bold in light only. The colour carries the meaning in both themes, but
 * the light palette has no middle: every accent lands at roughly the same
 * apparent weight there, so a green "healthy" beside a grey company name
 * reads as another grey line until you actually read it. Dark already has
 * that separation from contrast alone and does not need the weight, which
 * would only make it shout.
 */
export const MOMENTUM_STYLE: Record<DealMomentum, string> = {
  healthy: "text-ok light:font-semibold",
  stalling: "text-warn light:font-semibold",
  at_risk: "text-danger light:font-semibold",
};

/**
 * The left edge marking a deal's momentum in a list.
 *
 * A border and not a fill: a filled row competes with the status colour on
 * the right of the same row, and three saturated backgrounds down a pane
 * turn a list into a warning sign. An unanalysed deal gets no edge at all
 * rather than a grey one, because "nobody has looked at this yet" is a
 * different statement from "this is fine".
 */
export const MOMENTUM_EDGE: Record<DealMomentum, string> = {
  healthy: "border-l-2 border-l-ok",
  stalling: "border-l-2 border-l-warn",
  at_risk: "border-l-2 border-l-danger",
};

/**
 * A stored momentum read, with its age already turned into words.
 *
 * The age is precomputed rather than derived where it is drawn, and that
 * is not a style choice. `CompanyList` is a client component: a label
 * built from `Date.now()` inside it would be computed once on the server
 * and again in the browser, and the two would disagree the moment a render
 * straddles midnight. That is the same class of fault that took down the
 * login page. One clock, read on the server, passed down as a string.
 */
export interface DealInsightView {
  dealId: string;
  momentum: DealMomentum;
  reasoning: string;
  /** "today", "yesterday", "6 days ago". */
  age: string;
}

/**
 * How long ago an analysis was run, in words.
 *
 * Days and not hours, because the question this answers is "can I still
 * trust this reading", and that is measured in how many working days have
 * passed rather than in how many times the clock has gone round.
 *
 * `nowMs` is a parameter and not `Date.now()` so the whole list is dated
 * against one instant, and so this is testable without freezing time.
 */
export function analysisAge(analyzedAt: string, nowMs: number): string {
  const elapsedMs = nowMs - new Date(analyzedAt).getTime();
  const days = Math.floor(elapsedMs / 86_400_000);

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  return `${days} days ago`;
}

/**
 * Turns the stored rows into what a list needs to draw.
 *
 * Call this in a Server Component, once, with a single `nowMs`. Every
 * consumer then works from the same strings.
 */
export function toInsightViews(
  records: DealInsightRecord[],
  nowMs: number,
): DealInsightView[] {
  return records.map((record) => ({
    dealId: record.deal_id,
    momentum: record.momentum,
    reasoning: record.reasoning,
    age: analysisAge(record.analyzed_at, nowMs),
  }));
}
