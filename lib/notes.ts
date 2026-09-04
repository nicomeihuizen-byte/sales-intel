import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note, NoteKind } from "./types";

const NOTE_COLUMNS =
  "id, deal_id, contact_id, kind, user_id, content, created_at, updated_at";

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
  dealId?: string | null;
  contactId?: string | null;
  content: string;
  kind?: NoteKind;
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

  const dealId = input.dealId ?? null;
  const contactId = input.contactId ?? null;

  if (!dealId && !contactId) {
    throw new Error("A note has to belong to a deal or a contact.");
  }

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      deal_id: dealId,
      contact_id: contactId,
      kind: input.kind ?? "note",
      content,
    })
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

/**
 * Every note attached to one contact, oldest first. Includes notes that
 * are also attached to a deal, because from the person's side "what have
 * I said to Priya" does not care which deal it was about.
 */
export async function listNotesForContact(
  supabase: SupabaseClient,
  contactId: string,
): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load contact notes: ${error.message}`);
  }

  return (data ?? []) as Note[];
}

/**
 * How many notes each of these contacts has, as a map keyed by contact id.
 * One query for the whole pane rather than one per contact, since the
 * contact list renders every person at a company at once.
 */
export async function countNotesByContact(
  supabase: SupabaseClient,
  contactIds: string[],
): Promise<Record<string, number>> {
  if (contactIds.length === 0) {
    return {};
  }

  const { data, error } = await supabase
    .from("notes")
    .select("contact_id")
    .in("contact_id", contactIds);

  if (error) {
    throw new Error(`Failed to count contact notes: ${error.message}`);
  }

  const counts: Record<string, number> = {};

  for (const row of (data ?? []) as { contact_id: string | null }[]) {
    if (row.contact_id) {
      counts[row.contact_id] = (counts[row.contact_id] ?? 0) + 1;
    }
  }

  return counts;
}
