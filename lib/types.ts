// Row types for the three Phase 2 tables (supabase/migrations). These match
// the database columns exactly - if the schema changes, update both files
// together.

export interface Company {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export type DealStatus = "open" | "won" | "lost";

export interface Deal {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  status: DealStatus;
  created_at: string;
}

export interface Note {
  id: string;
  deal_id: string;
  user_id: string;
  content: string;
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
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
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
