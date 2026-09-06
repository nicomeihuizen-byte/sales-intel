import type { DealStatus } from "./types";

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
