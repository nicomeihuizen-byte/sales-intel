import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note } from "./types";

// Data-access layer for notes (Phase 4). See lib/deals.ts for why this
// lives here instead of inline in the route handlers and page components.

/**
 * Returns every note on a single deal, oldest first, so they read like a
 * timeline. Row Level Security on the `notes` table (supabase/schema.sql)
 * also confirms the deal belongs to the caller; this function doesn't
 * re-check ownership itself.
 */
export async function listNotesForDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("id, deal_id, user_id, content, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load notes: ${error.message}`);
  }

  return (data ?? []) as Note[];
}

export interface CreateNoteInput {
  dealId: string;
  content: string;
}

/**
 * Creates a note on a deal. Inserting with a `dealId` the caller doesn't
 * own fails the `notes` RLS policy (auth.uid() = user_id, and the deal's
 * own RLS keeps `deal_id` from being a way to write into someone else's
 * deal), so this surfaces as a normal Postgres error, not a silent no-op.
 */
export async function createNote(
  supabase: SupabaseClient,
  userId: string,
  input: CreateNoteInput,
): Promise<Note> {
  const content = input.content.trim();

  if (!content) {
    throw new Error("Note content is required.");
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: userId, deal_id: input.dealId, content })
    .select("id, deal_id, user_id, content, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create note: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Note;
}
