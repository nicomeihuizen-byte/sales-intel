import type { SupabaseClient } from "@supabase/supabase-js";
import type { Deal, DealStatus } from "./types";

// Data-access layer for deals (Phase 4). Both app/api/deals/route.ts and the
// deals Server Components import these functions instead of querying
// Supabase directly, so the query logic (and its Row Level Security
// assumptions) lives in exactly one place.

export interface DealWithCompany extends Deal {
  company_name: string;
}

interface DealRow {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  status: DealStatus;
  created_at: string;
  companies: { name: string } | { name: string }[] | null;
}

function companyNameFromRow(row: DealRow): string {
  const companies = row.companies;

  if (Array.isArray(companies)) {
    return companies[0]?.name ?? "Unknown company";
  }

  return companies?.name ?? "Unknown company";
}

function toDealWithCompany(row: DealRow): DealWithCompany {
  return {
    id: row.id,
    company_id: row.company_id,
    user_id: row.user_id,
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    company_name: companyNameFromRow(row),
  };
}

/**
 * Returns every deal owned by the signed-in user, most recent first, with
 * the parent company's name joined in so the deal list doesn't need a
 * second round trip per row. Row Level Security on the `deals` table
 * (supabase/migrations) is what actually scopes this to the caller - this
 * function issues an unfiltered select and relies on that policy.
 */
export async function listDealsForUser(
  supabase: SupabaseClient,
): Promise<DealWithCompany[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, company_id, user_id, title, status, created_at, companies(name)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load deals: ${error.message}`);
  }

  return ((data ?? []) as DealRow[]).map(toDealWithCompany);
}

/**
 * Returns a single deal by id, or null if it doesn't exist or isn't owned
 * by the signed-in user (RLS makes those two cases indistinguishable, which
 * is the correct behavior - an owned-by-someone-else deal should 404, not
 * reveal that it exists).
 */
export async function getDealById(
  supabase: SupabaseClient,
  dealId: string,
): Promise<DealWithCompany | null> {
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id, company_id, user_id, title, status, created_at, companies(name)",
    )
    .eq("id", dealId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load deal: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return toDealWithCompany(data as DealRow);
}

/**
 * Finds an existing company owned by the signed-in user with a
 * case-insensitive match on `name`, or creates one. Keeps the "new deal"
 * form to two fields (company name, deal title) instead of forcing a
 * separate "create company first" step.
 */
async function findOrCreateCompanyId(
  supabase: SupabaseClient,
  userId: string,
  companyName: string,
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", companyName)
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to look up company: ${findError.message}`);
  }

  if (existing) {
    return (existing as { id: string }).id;
  }

  const { data: created, error: createError } = await supabase
    .from("companies")
    .insert({ user_id: userId, name: companyName })
    .select("id")
    .single();

  if (createError || !created) {
    throw new Error(
      `Failed to create company: ${createError?.message ?? "unknown error"}`,
    );
  }

  return (created as { id: string }).id;
}

export interface CreateDealInput {
  companyName: string;
  title: string;
}

/**
 * Creates a deal for the signed-in user, finding or creating the parent
 * company by name first. `userId` must be the caller's own `auth.uid()` -
 * RLS enforces that too (`with check`), but passing it explicitly keeps the
 * insert payload self-describing and gives a clean validation error instead
 * of an opaque RLS rejection when the two ever disagree.
 */
export async function createDeal(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDealInput,
): Promise<Deal> {
  const companyName = input.companyName.trim();
  const title = input.title.trim();

  if (!companyName || !title) {
    throw new Error("Company name and deal title are required.");
  }

  const companyId = await findOrCreateCompanyId(supabase, userId, companyName);

  const { data, error } = await supabase
    .from("deals")
    .insert({ user_id: userId, company_id: companyId, title, status: "open" })
    .select("id, company_id, user_id, title, status, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create deal: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Deal;
}

/**
 * The three statuses a deal can hold, matching the deals_status_check
 * constraint in supabase/migrations and the branches in
 * app/api/insight/route.ts. Exported so the status picker renders exactly
 * these and nothing drifts between the UI, the API and the database.
 */
export const DEAL_STATUSES: DealStatus[] = ["open", "won", "lost"];

export function isDealStatus(value: unknown): value is DealStatus {
  return (
    typeof value === "string" && DEAL_STATUSES.includes(value as DealStatus)
  );
}

/**
 * Changes a deal's status. Validated here as well as by the database
 * constraint: the constraint is the backstop, but a rejected value should
 * come back as "that isn't a status" rather than as a raw Postgres
 * constraint violation shown to the user.
 *
 * Changing status changes which question the AI asks about the deal (see
 * app/api/insight/route.ts), so marking a deal won or lost is not just a
 * label - the next Analyze click runs a different analysis entirely.
 */
export async function updateDealStatus(
  supabase: SupabaseClient,
  dealId: string,
  status: DealStatus,
): Promise<Deal> {
  if (!isDealStatus(status)) {
    throw new Error(`"${status}" is not a deal status.`);
  }

  const { data, error } = await supabase
    .from("deals")
    .update({ status })
    .eq("id", dealId)
    .select("id, company_id, user_id, title, status, created_at")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update deal status: ${error.message}`);
  }

  if (!data) {
    throw new Error("That deal no longer exists.");
  }

  return data as Deal;
}

/**
 * Creates a deal on a company that already exists, for the form inside the
 * companies view where the company is whatever you have selected.
 *
 * This is the fix for the typo problem, not just a convenience. createDeal
 * above finds-or-creates a company by NAME, so "Minitb" quietly becomes a
 * second company holding one orphaned deal, and nothing about the form
 * tells you that happened. Choosing the company instead of typing it makes
 * that outcome unreachable.
 */
export async function createDealForCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  title: string,
): Promise<Deal> {
  const trimmed = title.trim();

  if (!trimmed) {
    throw new Error("A deal needs a title.");
  }

  const { data, error } = await supabase
    .from("deals")
    .insert({
      user_id: userId,
      company_id: companyId,
      title: trimmed,
      status: "open",
    })
    .select("id, company_id, user_id, title, status, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create deal: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Deal;
}

/**
 * Deletes a deal and, by the `notes.deal_id` foreign key's `on delete
 * cascade`, every note on it. That cascade is the reason the UI asks for a
 * second click: the deal row is small and the note history behind it is
 * not.
 *
 * Callers must check destructiveActionsEnabled() first. This function is
 * the mechanism, not the policy.
 */
export async function deleteDeal(
  supabase: SupabaseClient,
  dealId: string,
): Promise<void> {
  const { error } = await supabase.from("deals").delete().eq("id", dealId);

  if (error) {
    throw new Error(`Failed to delete deal: ${error.message}`);
  }
}
