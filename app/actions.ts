"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { revalidateWorkspace } from "@/lib/revalidate";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  createCompany,
  deleteCompany,
  listDealsForCompany,
  setProspect,
} from "@/lib/companies";
import {
  createNote,
  isNoteDirection,
  listNotesForAnalysis,
  setNoteConfidential,
} from "@/lib/notes";
import {
  analyzeDealMomentum,
  draftContactEmail,
  type ContactEmailDraft,
} from "@/lib/ai";
import { isDraftLanguage, type DraftLanguage } from "@/lib/draftLanguages";
import { forgetDealInsight, recordDealInsight } from "@/lib/insights";
import {
  createDealForCompany,
  deleteDeal,
  getDealById,
  listDealsForUser,
  parseEuroInput,
  updateDealValue,
} from "@/lib/deals";
import { defaultTheme, destructiveActionsEnabled } from "@/lib/featureFlags";
import { isTheme, THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme";
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

  revalidateWorkspace();
  return { error: null };
}

/**
 * Picks or drops one company as an active prospect.
 *
 * Sent from the companies page as a form with the id and the direction in
 * the body, rather than as a bound argument, so the whole row is a plain
 * `<form>` and the list keeps working with JavaScript still loading.
 *
 * Hitting the cap comes back as an error string on the page rather than a
 * thrown exception, because it is not a fault: it is the feature telling
 * you that five is five.
 */
export async function toggleProspectAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const companyId = formData.get("companyId");
  const picked = formData.get("picked") === "true";

  if (typeof companyId !== "string") {
    return { error: "Could not work out which company to pick." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await setProspect(supabase, companyId, picked);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update prospects.",
    };
  }

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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

  revalidateWorkspace();
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
      const notes = await listNotesForAnalysis(supabase, deal.id);
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

  revalidateWorkspace();

  return {
    error:
      failed > 0
        ? `${failed} deal${failed === 1 ? "" : "s"} could not be analysed. Open one and press Analyze to see why.`
        : null,
    analyzed,
    failed,
  };
}

/**
 * Remembers which theme you picked.
 *
 * Called from the toggle after it has already flipped the attribute on
 * <html>, so this is only the persistence half: the colours changed the
 * instant you clicked, and this is what makes them still be that way
 * tomorrow. That split is why the toggle feels instant despite the choice
 * living in a cookie on the server.
 *
 * `isTheme` runs again here even though the caller is our own component.
 * A server action is an HTTP endpoint whether or not anything on the page
 * points at it, and this value ends up in an attribute on <html>, so the
 * argument is treated as untrusted input rather than as a parameter.
 * Anything unrecognised falls back to the deployment default rather than
 * erroring, since the worst case is a visitor with a strange cookie
 * getting the theme they would have had anyway.
 *
 * Nothing is revalidated. The page on screen is already showing the new
 * theme, and re-rendering the whole layout to change one attribute the
 * browser has already changed is work with no visible result.
 */
export async function setThemeAction(theme: Theme): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(THEME_COOKIE, isTheme(theme) ? theme : defaultTheme(), {
    path: "/",
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    // Nothing in the browser needs to read this: the server stamps the
    // attribute, and the toggle knows the current theme from the DOM.
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export interface EmailDraftState {
  error: string | null;
  draft: ContactEmailDraft | null;
  // Echoed back so the language picker keeps the choice across a re-draft
  // instead of snapping to English every time the panel re-renders.
  language: DraftLanguage;
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
  formData: FormData,
): Promise<EmailDraftState> {
  const requested = formData.get("language");
  // Unknown values fall back to English rather than erroring. The value
  // reaches a prompt, so isDraftLanguage is the gate: nothing outside the
  // known set can be interpolated into it.
  const language: DraftLanguage = isDraftLanguage(requested)
    ? requested
    : previousState.language;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A failed re-draft keeps the draft already on screen. Pressing "write
  // another" and getting an error should not also take away the perfectly
  // good text you were about to copy.
  if (!user) {
    return {
      ...previousState,
      language,
      error: "You must be signed in to do that.",
    };
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

    const notes = await listNotesForAnalysis(supabase, deal.id);

    const draft = await draftContactEmail(
      {
        contactName: contact.name,
        contactRole: contact.role,
        companyName,
        dealTitle: deal.title,
        dealStatus: deal.status,
        senderName: senderNameFromEmail(user.email),
        language,
      },
      notes,
    );

    return { error: null, draft, language };
  } catch (error) {
    return {
      draft: previousState.draft,
      language,
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

/**
 * Records a note against a contact, with no deal attached.
 *
 * The gap this fills: a person you have talked to before there is a deal
 * had nowhere to put what was said. Such a note is deliberately invisible
 * to the momentum analysis, which only reads notes carrying a deal_id, so
 * logging a chat with someone cannot move a deal's health score.
 */
export async function createContactNoteAction(
  contactId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const content = formData.get("content");

  if (typeof content !== "string") {
    return { error: "A note needs some text." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    await createNote(supabase, userId, {
      contactId,
      content,
      confidential: formData.get("confidential") === "on",
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to add note.",
    };
  }

  revalidateWorkspace();
  return { error: null };
}

/**
 * Puts an email on the record: one you sent, or one you received.
 *
 * The app never sends anything and never reads a mailbox, so it cannot
 * know an email happened. This is the honest trigger: you press it after
 * the fact, and it records what actually went out or came in, because the
 * subject and body come from the boxes on screen rather than from
 * whatever was generated.
 *
 * Two things arrive from the form rather than from the call site.
 * `direction` comes from which of the two submit buttons was pressed,
 * because an empty box that can hold any email holds a reply as often as
 * a chase. `dealId` comes from the picker, because a company with two
 * live deals used to file every email against neither: the caller could
 * only supply a deal when there was exactly one, which was safe and
 * useless.
 *
 * A deal from the picker is checked against the contact's own company
 * before it is used. Row Level Security already stops anyone reaching
 * another user's deal; this stops one of your own emails being filed
 * against a deal at a different company, which RLS has no opinion about
 * and which would quietly feed the wrong deal's momentum read.
 */
export async function logEmailAction(
  contactId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const subject = formData.get("subject");
  const body = formData.get("body");
  const direction = formData.get("direction");
  const requestedDealId = formData.get("dealId");

  if (typeof body !== "string" || !body.trim()) {
    return { error: "An email needs a body. Paste it in and try again." };
  }

  if (!isNoteDirection(direction)) {
    return { error: "Say whether you sent this or received it." };
  }

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    const { data: contactRow, error: contactError } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("id", contactId)
      .maybeSingle();

    if (contactError) {
      throw new Error(contactError.message);
    }

    if (!contactRow) {
      throw new Error("That contact no longer exists.");
    }

    const companyId = (contactRow as { company_id: string }).company_id;

    // "" is the picker's "no deal", which is a real answer and not a
    // missing one: an email to someone you have no deal with still
    // belongs in that person's history.
    let dealId: string | null = null;

    if (typeof requestedDealId === "string" && requestedDealId) {
      const deal = await getDealById(supabase, requestedDealId);

      if (!deal || deal.company_id !== companyId) {
        return { error: "That deal is not at this contact's company." };
      }

      dealId = deal.id;
    }

    await createNote(supabase, userId, {
      contactId,
      dealId,
      content: body,
      kind: "email",
      subject: typeof subject === "string" ? subject : null,
      direction,
      // Marked at the moment of pasting rather than afterwards. A
      // sensitive email that has to be filed first and flagged second
      // spends the gap in between being an ordinary note.
      confidential: formData.get("confidential") === "on",
    });

    revalidateWorkspace();

    if (dealId) {
      revalidatePath(`/deals/${dealId}`);
    }

    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to log the email.",
    };
  }
}

/**
 * Marks one note confidential, or takes the mark off.
 *
 * Marking also **drops the deal's stored verdict**, which is the part
 * worth explaining. The stored reasoning in `deal_insights` is text the
 * model wrote while it could still see this note, and it often quotes the
 * notes directly - so leaving it in place would leave a sentence derived
 * from a confidential note sitting on the deals pane, which is exactly
 * what the toggle is supposed to prevent. "Never show up in any analysis"
 * has to include the analysis already on screen.
 *
 * The cost is that the deal reads "not analysed" and leaves the health
 * meter until you press Analyze again. That is a visible, explicable cost;
 * a quotation you thought you had withdrawn is not.
 *
 * Unmarking does not clear anything. Nothing has leaked, and the stored
 * verdict is then only stale in the ordinary way every stored verdict is
 * between analyses.
 */
export async function toggleNoteConfidentialAction(
  noteId: string,
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  // The value to set travels in the form rather than bound into the
  // action, so this reads like every other action in this file: a hidden
  // field carrying what the button means. It also keeps the signature the
  // shape useActionState actually calls, which is (state, formData).
  const confidential = formData.get("confidential") === "on";

  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { error: authError };
  }

  const supabase = await createServerSupabaseClient();

  try {
    const note = await setNoteConfidential(supabase, noteId, confidential);

    if (confidential && note.deal_id) {
      // Swallowed like every other insight write in this file: the note is
      // marked, which is what was asked for, and a stale cache row is not
      // worth turning a successful action into a visible failure.
      await forgetDealInsight(supabase, note.deal_id).catch(() => {});
    }

    revalidateWorkspace();

    if (note.deal_id) {
      revalidatePath(`/deals/${note.deal_id}`);
    }

    return { error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update that note.",
    };
  }
}

/**
 * Re-runs the momentum analysis for every open deal at one company.
 *
 * The pipeline strip's refresh does this across the whole pipeline, which
 * is the right scope when you are reading the numbers at the top. This is
 * the right scope when you are looking at one company: it costs a handful
 * of model calls instead of all of them, and it answers the question you
 * actually have, which is about the company in front of you.
 *
 * Failures are counted rather than thrown. One deal the model chokes on
 * should not cost you the other four.
 */
export async function analyzeCompanyDealsAction(
  companyId: string,
  previousState: RefreshState,
): Promise<RefreshState> {
  const { userId, error: authError } = await requireUserId();

  if (!userId) {
    return { ...previousState, error: authError };
  }

  const supabase = await createServerSupabaseClient();

  let openDeals;

  try {
    const deals = await listDealsForCompany(supabase, companyId);
    openDeals = deals
      .filter((deal) => deal.status === "open")
      .slice(0, MAX_DEALS_PER_REFRESH);
  } catch (error) {
    return {
      ...previousState,
      error: error instanceof Error ? error.message : "Failed to load deals.",
    };
  }

  if (openDeals.length === 0) {
    return { error: "No open deals here to analyse.", analyzed: 0, failed: 0 };
  }

  let analyzed = 0;
  let failed = 0;

  for (const deal of openDeals) {
    try {
      const notes = await listNotesForAnalysis(supabase, deal.id);
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

  revalidateWorkspace();

  return {
    error:
      failed > 0
        ? `${failed} deal${failed === 1 ? "" : "s"} could not be analysed. Open one and press Analyze to see why.`
        : null,
    analyzed,
    failed,
  };
}
