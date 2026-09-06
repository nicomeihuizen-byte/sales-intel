import type { DealMomentum, DealStatus } from "./types";

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

export const MOMENTUM_STYLE: Record<DealMomentum, string> = {
  healthy: "text-ok",
  stalling: "text-warn",
  at_risk: "text-danger",
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
