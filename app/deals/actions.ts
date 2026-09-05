"use server";

import { revalidatePath } from "next/cache";
import { revalidateWorkspace } from "@/lib/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createDeal, isDealStatus, updateDealStatus } from "@/lib/deals";
import { createNote, getNoteDealId, updateNote } from "@/lib/notes";

export interface DealActionState {
  error: string | null;
}

/**
 * Creates a deal from the "Add a deal" form on /deals. Finds or creates the
 * company by name (see lib/deals.ts) so the form stays two fields instead
 * of requiring a separate "create company" step first.
 */
export async function createDealAction(
  _previousState: DealActionState,
  formData: FormData,
): Promise<DealActionState> {
  const companyName = formData.get("companyName");
  const title = formData.get("title");

  if (typeof companyName !== "string" || typeof title !== "string") {
    return { error: "Company name and deal title are required." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a deal." };
  }

  try {
    await createDeal(supabase, user.id, { companyName, title });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create deal.",
    };
  }

  revalidateWorkspace();
  return { error: null };
}

export interface NoteActionState {
  error: string | null;
}

/**
 * Creates a note on a deal from the NoteForm on /deals/[id]. `dealId` is
 * bound by the caller (NoteForm.tsx) via `createNoteAction.bind(null,
 * dealId)`, since useActionState only passes (previousState, formData).
 */
export async function createNoteAction(
  dealId: string,
  _previousState: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const content = formData.get("content");

  if (typeof content !== "string") {
    return { error: "Note content is required." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to add a note." };
  }

  try {
    await createNote(supabase, user.id, {
      dealId,
      content,
      confidential: formData.get("confidential") === "on",
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add note.",
    };
  }

  revalidatePath(`/deals/${dealId}`);
  revalidateWorkspace();
  return { error: null };
}

/**
 * Rewrites an existing note from the inline editor in NoteList. Takes only
 * the note id from the client: the deal to revalidate is looked up
 * server-side (getNoteDealId) rather than trusted from the form, so a
 * tampered dealId can't be used to probe which deals exist by watching
 * which paths revalidate.
 *
 * The note's created_at is untouched by design - see updateNote in
 * lib/notes.ts for why that matters to the momentum analysis.
 */
export async function updateNoteAction(
  noteId: string,
  _previousState: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const content = formData.get("content");

  if (typeof content !== "string") {
    return { error: "Note content is required." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to edit a note." };
  }

  try {
    await updateNote(supabase, { noteId, content });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to edit note.",
    };
  }

  const dealId = await getNoteDealId(supabase, noteId);

  if (dealId) {
    revalidatePath(`/deals/${dealId}`);
  }

  revalidateWorkspace();
  return { error: null };
}

export interface DealStatusActionState {
  error: string | null;
}

/**
 * Changes a deal's status from the picker in the deals pane.
 *
 * Worth being clear about what this does beyond relabelling: the status
 * decides which question app/api/insight/route.ts asks the model. Marking
 * a deal won swaps the momentum read for a win analysis, marking it lost
 * swaps it for a loss post-mortem. The picker's helper text says so, since
 * it is not obvious from a dropdown.
 */
export async function updateDealStatusAction(
  dealId: string,
  _previousState: DealStatusActionState,
  formData: FormData,
): Promise<DealStatusActionState> {
  const status = formData.get("status");

  if (!isDealStatus(status)) {
    return { error: "That is not a deal status." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to change a deal." };
  }

  try {
    await updateDealStatus(supabase, dealId, status);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to change status.",
    };
  }

  revalidateWorkspace();
  revalidatePath(`/deals/${dealId}`);
  return { error: null };
}
