import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Deal } from "./types";

// Data-access layer for companies. Until the two-pane view existed,
// companies were only ever created as a side effect of creating a deal
// (findOrCreateCompanyId in lib/deals.ts) and never listed on their own.

export interface CompanyWithCounts extends Company {
  deal_count: number;
  contact_count: number;
}

interface CompanyRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  deals: { count: number }[] | null;
  contacts: { count: number }[] | null;
}

/**
 * PostgREST returns an aggregate embed as an array holding a single
 * `{ count }` object. Reading it defensively rather than trusting
 * `rows[0].count` keeps a shape change in the client library from becoming
 * a NaN rendered into the sidebar.
 */
function countFromEmbed(embed: { count: number }[] | null): number {
  const first = embed?.[0]?.count;
  return typeof first === "number" ? first : 0;
}

/**
 * Every company owned by the signed-in user, alphabetically, with how many
 * deals and contacts each one has. Alphabetical rather than newest-first
 * because this is a list you scan for a known name, not a feed.
 */
export async function listCompaniesForUser(
  supabase: SupabaseClient,
): Promise<CompanyWithCounts[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, user_id, name, created_at, deals(count), contacts(count)")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  return ((data ?? []) as CompanyRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    created_at: row.created_at,
    deal_count: countFromEmbed(row.deals),
    contact_count: countFromEmbed(row.contacts),
  }));
}

/**
 * One company by id, or null when it doesn't exist or isn't the caller's.
 * RLS makes those two cases indistinguishable, which is correct: a company
 * belonging to someone else should read as absent, not as forbidden.
 */
export async function getCompanyById(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, user_id, name, created_at")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load company: ${error.message}`);
  }

  return (data as Company | null) ?? null;
}

/**
 * Creates a company with no deal attached. The deal form still creates
 * companies implicitly, but a prospect you have only spoken to needs to
 * exist before there is anything to call a deal.
 */
export async function createCompany(
  supabase: SupabaseClient,
  userId: string,
  name: string,
): Promise<Company> {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("A company needs a name.");
  }

  const { data: existing, error: findError } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to look up company: ${findError.message}`);
  }

  if (existing) {
    throw new Error(`"${trimmed}" is already in your list.`);
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ user_id: userId, name: trimmed })
    .select("id, user_id, name, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create company: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Company;
}

/**
 * Every deal belonging to one company, newest first. Deliberately not
 * reusing listDealsForUser + a filter: that function joins the company
 * name onto every row, which is redundant when the company is already the
 * thing you selected.
 */
export async function listDealsForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("id, company_id, user_id, title, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load deals for company: ${error.message}`);
  }

  return (data ?? []) as Deal[];
}

/**
 * Deletes a company only when nothing hangs off it.
 *
 * `companies` cascades to deals, which cascade to notes, so an unguarded
 * delete here would take a note history with it on one click. Refusing
 * unless the company is empty makes the destructive case unreachable
 * without removing the deals first, which is a second deliberate act.
 *
 * That also matches the actual need: this exists to clean up the empty
 * company a misspelled name leaves behind, not to wipe a real account.
 *
 * The count is read here rather than trusted from the page that rendered
 * the button, because the page's numbers are from whenever it rendered and
 * the decision has to be made against the database as it is now.
 */
export async function deleteCompanyIfEmpty(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { count: dealCount, error: dealError } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (dealError) {
    throw new Error(`Failed to check for deals: ${dealError.message}`);
  }

  if ((dealCount ?? 0) > 0) {
    throw new Error(
      "This company still has deals. Remove those first, so their notes don't disappear with it.",
    );
  }

  const { count: contactCount, error: contactError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (contactError) {
    throw new Error(`Failed to check for contacts: ${contactError.message}`);
  }

  if ((contactCount ?? 0) > 0) {
    throw new Error("This company still has contacts. Remove those first.");
  }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to delete company: ${error.message}`);
  }
}
