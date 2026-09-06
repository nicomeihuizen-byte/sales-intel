import type { SupabaseClient } from "@supabase/supabase-js";
import { profileHref } from "./links";
import type { Contact } from "./types";

// Data-access layer for contacts. Same shape and the same Row Level
// Security assumptions as lib/deals.ts and lib/notes.ts: every query here
// is unfiltered by user, because the `contacts` policy
// (supabase/migrations) is what scopes it to the caller.

const CONTACT_COLUMNS =
  "id, company_id, user_id, name, role, location, address, emails, phones, socials, created_at, updated_at";

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
  location?: string;
  address?: string;
  emails?: string[];
  phones?: string[];
  socials?: string[];
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

  // Trims every entry, drops the blanks, and removes duplicates. The form
  // renders a spare empty row for adding another address, so a submit
  // almost always arrives with at least one empty string in the list; that
  // is expected input, not an error.
  const cleanList = (values: string[] | undefined) =>
    Array.from(
      new Set(
        (values ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

  const name = input.name.trim();

  if (!name) {
    throw new Error("A contact needs at least a name.");
  }

  return {
    name,
    role: blankToNull(input.role),
    location: blankToNull(input.location),
    address: blankToNull(input.address),
    emails: cleanList(input.emails),
    phones: cleanList(input.phones),
    // Normalized to full URLs on the way in, so the display side never has
    // to guess a scheme and a pasted `linkedin.com/in/someone` is a
    // working link rather than a dead one. Anything that will not parse
    // into an http(s) URL is kept as typed - an @handle is a legitimate
    // thing to write down, and lib/links.ts renders it as plain text.
    socials: cleanList(input.socials).map(
      (value) => profileHref(value) ?? value,
    ),
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
 * Replaces every editable field on a contact, so clearing a phone box in
 * the form actually removes that number instead of leaving it behind. `updated_at` is set here rather than by a database trigger,
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
 * Moves a contact to another company.
 *
 * Its own function rather than a field on the edit form, because moving a
 * person is a different intent from correcting their phone number. A
 * company picker sitting in the edit form would relocate someone the first
 * time a stray keystroke landed on a select, and nothing on screen would
 * say it had happened until they went missing from the list.
 *
 * The target is read back before the write, and that check is the point of
 * this function. RLS makes another user's company invisible to a select
 * but not to a foreign key: an id belonging to somebody else would satisfy
 * the constraint and quietly move this contact out of reach. Same hole,
 * and same guard, as assertParentIsUsable in lib/companies.ts.
 */
export async function moveContact(
  supabase: SupabaseClient,
  contactId: string,
  targetCompanyId: string,
): Promise<void> {
  const { data: target, error: targetError } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", targetCompanyId)
    .maybeSingle();

  if (targetError) {
    throw new Error(`Failed to look up that company: ${targetError.message}`);
  }

  if (!target) {
    throw new Error("That company is not in your list.");
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({
      company_id: targetCompanyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", contactId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to move contact: ${error.message}`);
  }

  if (!data) {
    throw new Error("That contact no longer exists.");
  }
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
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`);
  }
}
