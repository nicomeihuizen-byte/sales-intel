import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note } from "./types";

const NOTE_COLUMNS = "id, deal_id, user_id, content, created_at, updated_at";

// Data-access layer for notes (Phase 4). See lib/deals.ts for why this
// lives here instead of inline in the route handlers and page components.

/**
 * Returns every note on a single deal, oldest first, so they read like a
 * timeline. Row Level Security on the `notes` table (supabase/migrations)
 * also confirms the deal belongs to the caller; this function doesn't
 * re-check ownership itself.
 */
export async function listNotesForDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
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
    .select(NOTE_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create note: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Note;
}

export interface UpdateNoteInput {
  noteId: string;
  content: string;
}

/**
 * Rewrites a note's text. `created_at` is deliberately left alone: the
 * momentum analysis in lib/ai.ts reasons about the gaps between note
 * dates, so a note that jumped to today because a typo was fixed would
 * change the model's read of a deal's whole history. Only `updated_at`
 * moves, and the UI shows it as "edited" beside the original date.
 *
 * An id the caller doesn't own matches no rows under RLS rather than
 * erroring, so `maybeSingle()` comes back empty and that surfaces as "no
 * longer exists" - the same message a genuinely deleted note gives, which
 * is correct: neither case should reveal whether the row is out there.
 */
export async function updateNote(
  supabase: SupabaseClient,
  input: UpdateNoteInput,
): Promise<Note> {
  const content = input.content.trim();

  if (!content) {
    throw new Error("Note content is required.");
  }

  const { data, error } = await supabase
    .from("notes")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", input.noteId)
    .select(NOTE_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update note: ${error.message}`);
  }

  if (!data) {
    throw new Error("That note no longer exists.");
  }

  return data as Note;
}

/**
 * Returns the deal a note belongs to, so a server action can revalidate
 * the right page after an edit without trusting a dealId sent from the
 * browser alongside the note id.
 */
export async function getNoteDealId(
  supabase: SupabaseClient,
  noteId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("notes")
    .select("deal_id")
    .eq("id", noteId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up note: ${error.message}`);
  }

  return (data as { deal_id: string } | null)?.deal_id ?? null;
}
