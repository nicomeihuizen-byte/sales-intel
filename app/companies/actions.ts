"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createCompany, deleteCompany } from "@/lib/companies";
import { createDealForCompany, deleteDeal } from "@/lib/deals";
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

  return {
    name,
    role: optional("role"),
    email: optional("email"),
    phone: optional("phone"),
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
