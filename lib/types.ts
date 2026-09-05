// Row types for the three Phase 2 tables (supabase/migrations). These match
// the database columns exactly - if the schema changes, update both files
// together.

export interface Company {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  // When this company was picked as one of the active prospects, or null
  // when it is not picked. A timestamp rather than a boolean so the
  // prospects list has a stable order and can say how long each one has
  // been sitting there without moving.
  prospect_since: string | null;
  // Everything below is optional by design. A prospect starts as a name
  // heard on a call, and the rest arrives over the following weeks. Null
  // means "not filled in", never "none": the panel prints nothing for a
  // null rather than a dash, because a dash reads like an answer.
  //
  // One line on what they do. A stable fact, the same class as the
  // address: no date on it, nothing that decays, nothing that could hide
  // from the timeline. Deliberately not a notes field, and deliberately
  // not prospect_intent (which belongs to the slot, not the company, and
  // is supposed to go stale).
  description: string | null;
  // One free-text address rather than street/postcode/city broken out.
  // Addresses get pasted in as a block, and nothing here sorts on the
  // parts. `country` is separate because it is the one part used on its
  // own: it decides the VAT treatment.
  address: string | null;
  country: string | null;
  // Stored with the scheme already on the front (see normalizeCompanyInput),
  // so rendering a link never has to guess and anything that will not parse
  // into a safe URL is refused at the form rather than silently dropped at
  // the anchor.
  website: string | null;
  email: string | null;
  phone: string | null;
  // Same list, and the same reasoning, as `socials` on Contact below.
  socials: string[];
  // Two registries, two numbers, two documents: VAT goes on the quote, the
  // registration number (KvK, HRB, Companies House) goes on the contract.
  vat_number: string | null;
  registration_number: string | null;
  // The company this one is part of, or null at the top of a group.
  //
  // Points up rather than holding a list of subsidiaries, so the fact is
  // stored once. The children are found by asking which companies point
  // here, which is what companies_parent_id_idx exists for.
  parent_id: string | null;
}

export type DealStatus = "open" | "won" | "lost";

export interface Deal {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  status: DealStatus;
  created_at: string;
  // Euros. Null means nobody has put a number on this deal yet, which is
  // different from zero: an unpriced deal is left out of the pipeline
  // totals rather than dragging them down.
  value_eur: number | null;
  // Set when the deal moves to won or lost, cleared if it reopens. Null on
  // every deal that closed before this column existed, which is why the
  // conversion-time metric counts only the deals it can actually date.
  closed_at: string | null;
}

// What a note records. "note" is something that happened; "email" is a
// message, logged so the history knows about contact the app itself never
// made.
export type NoteKind = "note" | "email";

// Which way an email went. Only ever set on a note of kind "email", and
// always set on one - the database enforces both halves.
//
// This is the difference between "I chased them again" and "they replied",
// which is most of what momentum is. Before this existed every logged
// email was outbound by construction, so it could be left implicit; once
// any email body can be pasted in, leaving it implicit means filing a
// prospect's answer as another unanswered chase.
export type NoteDirection = "outbound" | "inbound";

export interface Note {
  id: string;
  // A note belongs to a deal, a contact, or both, and the database
  // refuses one with neither. Only notes with a deal_id feed that deal's
  // momentum analysis: a note about a person you have no deal with should
  // not be able to move a deal's health score.
  deal_id: string | null;
  contact_id: string | null;
  kind: NoteKind;
  // The email's subject line, held apart from the body rather than
  // written into the top of it. Null on a plain note, and null on an
  // email logged before the column existed whose content did not carry
  // the old "Sent: " prefix.
  subject: string | null;
  direction: NoteDirection | null;
  user_id: string;
  content: string;
  // Kept out of every prompt, and never sent to the model in any form.
  // Still fully visible in the app: this is not a lock on your own
  // record, it is a line the record does not cross on its way out.
  //
  // The cost is deliberate and was chosen with eyes open: momentum is read
  // from the gaps between notes, so marking one makes the deal look
  // quieter than it was on that date. The timeline badges it so the gap
  // has a visible explanation rather than looking like silence.
  confidential: boolean;
  created_at: string;
  // Set on every edit. created_at is what the timeline and the AI's gap
  // reasoning use, so editing a note never changes where it sits in the
  // history - updated_at only records that the text was corrected.
  updated_at: string;
}

// A person at a company. Only `name` is required: a prospect often starts
// as a name and a LinkedIn profile, and the rest arrives later.
export interface Contact {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  role: string | null;
  // Lists rather than single values: people have a work address and a
  // personal one, a mobile and a desk line. Always an array, never null,
  // so callers never have to check both "missing" and "empty".
  emails: string[];
  phones: string[];
  // Was one linkedin_url. A column named after one network is a schema
  // that argues with the person filling it in, and they win by pasting an
  // X profile into the LinkedIn box. The label is derived from the URL
  // instead (socialLabel in lib/links.ts), so the data says which network
  // it is rather than the column name claiming to.
  socials: string[];
  created_at: string;
  updated_at: string;
}

// The stalled-deal insight result (Phase 5). Declared here now so lib/ai.ts
// and components/InsightPanel.tsx have a shared, non-`any` shape to build
// against once that phase starts.
export type DealMomentum = "healthy" | "stalling" | "at_risk";

export interface DealInsight {
  status: DealMomentum;
  reasoning: string;
  // Concrete actions the rep should take next on this specific deal, in
  // priority order, rendered as bullets under the reasoning. Always at
  // least one entry: a deal still in play always has something to do,
  // even if that something is "decide whether to disqualify it".
  nextSteps: string[];
}

// Loss post-mortem result, for a deal already marked "lost" - a separate
// question from momentum (which only applies to a deal still in play).
// "confirmed_lost" means the loss looks final with no realistic path back;
// "worth_revisiting" means the notes show a specific unaddressed objection,
// unexplored stakeholder, or timing factor that could be worth a future
// check-in.
export type LossReviewVerdict = "confirmed_lost" | "worth_revisiting";

export interface DealLossReview {
  verdict: LossReviewVerdict;
  reasoning: string;
  // What to actually do about the loss. The verdict changes what these
  // mean, which is why the panel labels them differently per verdict: on
  // "worth_revisiting" they are the steps of a re-approach (who to
  // contact, what to lead with, when), on "confirmed_lost" they are what
  // to do differently in the next deal of this shape.
  recommendedActions: string[];
}

// Win analysis result, for a deal already marked "won" - the mirror of
// DealLossReview. The "pattern" classification captures the shape of how
// the deal actually closed, which is the repeatable part a rep can look
// for in a future deal: "fast_and_clean" (short cycle, minimal friction),
// "steady_and_thorough" (longer cycle, but consistent forward motion with
// no real stalls), or "recovered_momentum" (a real stall or setback
// partway through that still closed).
export type WinPattern =
  | "fast_and_clean"
  | "steady_and_thorough"
  | "recovered_momentum";

export interface DealWinReview {
  pattern: WinPattern;
  reasoning: string;
  // The plays from this deal a rep could deliberately run again in the
  // next one. Phrased as instructions ("open the security review before
  // the pilot ends"), not as observations about what happened, so the
  // list is usable on a different deal than the one it came from.
  repeatablePlays: string[];
}

// The stored result of the last momentum analysis for a deal, read by the
// pipeline health meter. A cache of the model's current opinion, not a
// history: one row per deal, replaced on each run.
export interface DealInsightRecord {
  id: string;
  deal_id: string;
  user_id: string;
  momentum: DealMomentum;
  reasoning: string;
  analyzed_at: string;
}

// What the metrics panel renders. Every field is derived, nothing here is
// stored: see lib/metrics.ts.
export interface PipelineMetrics {
  // 0 to 100, or null when no open deal has been analysed yet. Null and
  // zero mean very different things here, so the meter shows "not
  // analysed" rather than an empty bar.
  healthScore: number | null;
  analyzedDeals: number;
  openDeals: number;
  openValueEur: number;
  wonDeals: number;
  wonValueEur: number;
  // Average months from a deal being created to being marked won. Null
  // until at least one deal has both dates.
  averageMonthsToWin: number | null;
  wonDealsWithDates: number;
  // The oldest analysis feeding healthScore, so the panel can say how
  // stale the number is instead of implying it is live.
  oldestAnalysisAt: string | null;
}
