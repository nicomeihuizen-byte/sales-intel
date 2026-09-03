import type { SupabaseClient } from "@supabase/supabase-js";
import type { Contact } from "./types";

// Data-access layer for contacts. Same shape and the same Row Level
// Security assumptions as lib/deals.ts and lib/notes.ts: every query here
// is unfiltered by user, because the `contacts` policy
// (supabase/migrations) is what scopes it to the caller.

const CONTACT_COLUMNS =
  "id, company_id, user_id, name, role, email, phone, linkedin_url, created_at, updated_at";

/**
 * Every contact at one company, oldest first so the order stays stable as
 * you add people rather than reshuffling on each edit.
 */
export async function listContactsForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load contacts: ${error.message}`);
  }

  return (data ?? []) as Contact[];
}

export interface ContactInput {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

/**
 * Trims every field and turns the empty ones into null rather than empty
 * strings, so "has no phone number" is one value in the database instead
 * of two ("" and null) that every caller would have to check for.
 */
function normalizeContactInput(input: ContactInput) {
  const blankToNull = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const name = input.name.trim();

  if (!name) {
    throw new Error("A contact needs at least a name.");
  }

  return {
    name,
    role: blankToNull(input.role),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    linkedin_url: blankToNull(input.linkedinUrl),
  };
}

export async function createContact(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  input: ContactInput,
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      company_id: companyId,
      ...normalizeContactInput(input),
    })
    .select(CONTACT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create contact: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Contact;
}

/**
 * Replaces every editable field on a contact, so clearing the phone box in
 * the form actually clears the phone number instead of leaving the old one
 * behind. `updated_at` is set here rather than by a database trigger,
 * keeping the schema plain at the cost of remembering it in this one place.
 */
export async function updateContact(
  supabase: SupabaseClient,
  contactId: string,
  input: ContactInput,
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update({
      ...normalizeContactInput(input),
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .select(CONTACT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update contact: ${error.message}`);
  }

  if (!data) {
    throw new Error("That contact no longer exists.");
  }

  return data as Contact;
}

/**
 * Deletes a contact. A delete of a row the caller doesn't own matches no
 * rows under RLS rather than erroring, which is indistinguishable from
 * deleting something already gone - both are reported the same way here on
 * purpose, since neither should tell the caller whether the row exists.
 */
export async function deleteContact(
  supabase: SupabaseClient,
  contactId: string,
): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", contactId);

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`);
  }
}
