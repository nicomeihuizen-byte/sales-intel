"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createCompany, deleteCompany } from "@/lib/companies";
import { listNotesForDeal } from "@/lib/notes";
import {
  analyzeDealMomentum,
  draftContactEmail,
  type ContactEmailDraft,
} from "@/lib/ai";
import { recordDealInsight } from "@/lib/insights";
import {
  createDealForCompany,
  deleteDeal,
  getDealById,
  listDealsForUser,
  parseEuroInput,
  updateDealValue,
} from "@/lib/deals";
import { destructiveActionsEnabled } from "@/lib/featureFlags";
import {
  createContact,
  deleteContact,
  updateContact,
  type ContactInput,
} from "@/lib/contacts";

export interface FormState {
  error: string | null;
}

/**
 * Reads the five contact fields off a FormData. Returns null when `name`
 * is missing or not a string, which is the only field the database
 * requires - the rest come back as undefined and lib/contacts.ts turns
 * them into nulls.
 */
function contactInputFromForm(formData: FormData): ContactInput | null {
  const name = formData.get("name");

  if (typeof name !== "string") {
    return null;
  }

  const optional = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  };

  // getAll, because the form renders one input per address plus a spare
  // empty one. lib/contacts.ts trims, drops the blanks and de-duplicates,
  // so a submit carrying empty rows is normal input rather than an error.
  const list = (field: string) =>
    formData.getAll(field).filter((value): value is string => typeof value === "string");

  return {
    name,
    role: optional("role"),
    emails: list("emails"),
    phones: list("phones"),
    linkedinUrl: optional("linkedinUrl"),
  };
}

async function requireUserId(): Promise<
  { userId: string; error: null } | { userId: null; error: string }
> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user
    ? { userId: user.id, error: null }
    : { userId: null, error: "You must be signed in to do that." };
}

/**
 * Creates a company with no deal attached, from the form above the company
 * list. Deals still create companies implicitly by name, but a prospect
 * you have only had a first call with needs somewhere to live before there
 * is a deal to put it under.
 */
export async function createCompanyAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = formData.get("name");

  if (typeof name !== "string") {
    return { error: "A company needs a name." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await createCompany(supabase, userId, name);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create company.",
    };
  }

  revalidatePath("/companies");
  return { error: null };
}

export async function createContactAction(
  companyId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = contactInputFromForm(formData);

  if (!input) {
    return { error: "A contact needs at least a name." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await createContact(supabase, userId, companyId, input);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to add contact.",
    };
  }

  revalidatePath("/companies");
  return { error: null };
}

export async function updateContactAction(
  contactId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = contactInputFromForm(formData);

  if (!input) {
    return { error: "A contact needs at least a name." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await updateContact(supabase, contactId, input);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update contact.",
    };
  }

  revalidatePath("/companies");
  return { error: null };
}

/**
 * Removes a contact. Unlike the other three, the id arrives in the form
 * body rather than bound by the caller, purely so this action has the same
 * (previousState, formData) shape every other action in the app has.
 * Either way the id comes from the browser and RLS is what stops it
 * pointing at someone else's row.
 */
export async function deleteContactAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const contactId = formData.get("contactId");

  if (typeof contactId !== "string") {
    return { error: "Could not work out which contact to remove." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await deleteContact(supabase, contactId);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete contact.",
    };
  }

  revalidatePath("/companies");
  return { error: null };
}

/**
 * Every action below can destroy data, so each one re-checks
 * destructiveActionsEnabled() itself rather than trusting that the page
 * only renders its button when the flag is on. A server action is a real
 * HTTP endpoint: it exists whether or not anything on the page points at
 * it, so hiding the button is presentation and this check is the control.
 */
function assertDestructiveAllowed(): string | null {
  return destructiveActionsEnabled()
    ? null
    : "Deleting is turned off in this environment.";
}

export async function createDealForCompanyAction(
  companyId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const title = formData.get("title");

  if (typeof title !== "string") {
    return { error: "A deal needs a title." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await createDealForCompany(supabase, userId, companyId, title);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create deal.",
    };
  }

  revalidatePath("/companies");
  revalidatePath("/deals");
  return { error: null };
}

export async function deleteDealAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const blocked = assertDestructiveAllowed();

  if (blocked) {
    return { error: blocked };
  }

  const dealId = formData.get("dealId");

  if (typeof dealId !== "string") {
    return { error: "Could not work out which deal to remove." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await deleteDeal(supabase, dealId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to remove deal.",
    };
  }

  revalidatePath("/companies");
  revalidatePath("/deals");
  return { error: null };
}

export async function deleteCompanyAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const blocked = assertDestructiveAllowed();

  if (blocked) {
    return { error: blocked };
  }

  const companyId = formData.get("companyId");

  if (typeof companyId !== "string") {
    return { error: "Could not work out which company to remove." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await deleteCompany(supabase, companyId);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to remove company.",
    };
  }

  revalidatePath("/companies");
  revalidatePath("/deals");
  return { error: null };
}

export async function updateDealValueAction(
  dealId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formData.get("valueEur");

  if (typeof raw !== "string") {
    return { error: "Enter a number, or leave it empty." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await updateDealValue(supabase, dealId, parseEuroInput(raw));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save value.",
    };
  }

  revalidatePath("/companies");
  revalidatePath("/deals");
  return { error: null };
}

// A refresh runs one AI call per open deal, so the ceiling stops a large
// pipeline (or a public demo) from turning one click into forty requests.
// Deals are analysed newest first, so the cap drops the stalest rather
// than an arbitrary slice.
const MAX_DEALS_PER_REFRESH = 12;

export interface RefreshState {
  error: string | null;
  analyzed: number;
  failed: number;
}

/**
 * Re-analyses every open deal and stores the results, which is what moves
 * the pipeline health meter.
 *
 * One deal failing does not fail the run. A single unanalysable deal
 * (a malformed AI response, a rate limit) should cost you that deal's
 * contribution to the score, not the other eleven, so failures are counted
 * and reported rather than thrown.
 */
export async function refreshPipelineAction(
  previousState: RefreshState,
): Promise<RefreshState> {
  const { userId, error: authError } = await requireUserId();

  // Failures keep the previous run's count, so an error doesn't also wipe
  // "8 deals re-analysed" off the panel and leave you wondering whether
  // the earlier run happened at all.
  if (!userId) {
    return { ...previousState, error: authError };
  }

  const supabase = await createServerSupabaseClient();

  let openDeals;

  try {
    const deals = await listDealsForUser(supabase);
    openDeals = deals
      .filter((deal) => deal.status === "open")
      .slice(0, MAX_DEALS_PER_REFRESH);
  } catch (error) {
    return {
      ...previousState,
      error: error instanceof Error ? error.message : "Failed to load deals.",
    };
  }

  let analyzed = 0;
  let failed = 0;

  for (const deal of openDeals) {
    try {
      const notes = await listNotesForDeal(supabase, deal.id);
      const insight = await analyzeDealMomentum(deal.title, notes);
      await recordDealInsight(
        supabase,
        userId,
        deal.id,
        insight.status,
        insight.reasoning,
      );
      analyzed += 1;
    } catch {
      failed += 1;
    }
  }

  revalidatePath("/companies");

  return {
    error:
      failed > 0
        ? `${failed} deal${failed === 1 ? "" : "s"} could not be analysed. Open one and press Analyze to see why.`
        : null,
    analyzed,
    failed,
  };
}

export interface EmailDraftState {
  error: string | null;
  draft: ContactEmailDraft | null;
}

/**
 * Turns a name and a note history into a follow-up email to copy.
 *
 * `dealId` is whatever the page has selected. When nothing is selected the
 * company's most recent deal is used instead, since a contact with no deal
 * in view still has one deal that matters most, and asking the user to
 * pick first would put a step in front of a one-click feature.
 *
 * The sender's name is derived from the signed-in email address rather
 * than stored anywhere. It is a signature on a draft nobody sends
 * automatically, so a rough guess is better than another settings field.
 */
export async function draftEmailAction(
  contactId: string,
  dealId: string | null,
  previousState: EmailDraftState,
): Promise<EmailDraftState> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A failed re-draft keeps the draft already on screen. Pressing "write
  // another" and getting an error should not also take away the perfectly
  // good text you were about to copy.
  if (!user) {
    return { ...previousState, error: "You must be signed in to do that." };
  }

  try {
    const { data: contactRow, error: contactError } = await supabase
      .from("contacts")
      .select("id, name, role, company_id, companies(name)")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError) {
      throw new Error(contactError.message);
    }

    if (!contactRow) {
      throw new Error("That contact no longer exists.");
    }

    const contact = contactRow as {
      id: string;
      name: string;
      role: string | null;
      company_id: string;
      companies: { name: string } | { name: string }[] | null;
    };

    const companyName = Array.isArray(contact.companies)
      ? (contact.companies[0]?.name ?? "their company")
      : (contact.companies?.name ?? "their company");

    let deal = dealId ? await getDealById(supabase, dealId) : null;

    if (!deal || deal.company_id !== contact.company_id) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("deals")
        .select("id")
        .eq("company_id", contact.company_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (fallbackError) {
        throw new Error(fallbackError.message);
      }

      const fallbackId = (fallbackRows ?? [])[0]?.id as string | undefined;
      deal = fallbackId ? await getDealById(supabase, fallbackId) : null;
    }

    if (!deal) {
      throw new Error(
        "There is no deal for this company yet, so there is nothing to write about.",
      );
    }

    const notes = await listNotesForDeal(supabase, deal.id);

    const draft = await draftContactEmail(
      {
        contactName: contact.name,
        contactRole: contact.role,
        companyName,
        dealTitle: deal.title,
        dealStatus: deal.status,
        senderName: senderNameFromEmail(user.email),
      },
      notes,
    );

    return { error: null, draft };
  } catch (error) {
    return {
      draft: previousState.draft,
      error:
        error instanceof Error ? error.message : "Failed to draft an email.",
    };
  }
}

/**
 * "nico@meihuizen.ai" becomes "Nico"; "jan.de.vries@x.com" becomes "Jan De
 * Vries". Falls back to "me" when there is no address at all, which only
 * happens in states the auth layer should already have caught.
 */
function senderNameFromEmail(email: string | undefined): string {
  const local = email?.split("@")[0];

  if (!local) {
    return "me";
  }

  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
