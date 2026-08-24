// Row types for the three Phase 2 tables (supabase/schema.sql). These match
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
}

// The stalled-deal insight result (Phase 5). Declared here now so lib/ai.ts
// and components/InsightPanel.tsx have a shared, non-`any` shape to build
// against once that phase starts.
export type DealMomentum = "healthy" | "stalling" | "at_risk";

export interface DealInsight {
  status: DealMomentum;
  reasoning: string;
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
}
