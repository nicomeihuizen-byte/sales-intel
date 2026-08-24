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
