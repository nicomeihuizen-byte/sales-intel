import type { SupabaseClient } from "@supabase/supabase-js";
import type { Deal, DealStatus } from "./types";

// Data-access layer for deals (Phase 4). Both app/api/deals/route.ts and the
// deals Server Components import these functions instead of querying
// Supabase directly, so the query logic (and its Row Level Security
// assumptions) lives in exactly one place.

export interface DealWithCompany extends Deal {
  company_name: string;
}

// One place for the deal column list, so a new column reaches every query
// at once. Two of these (value_eur, closed_at) feed the metrics panel, and
// a query that quietly omitted them would show the panel a zero rather
// than an error.
const DEAL_COLUMNS =
  "id, company_id, user_id, title, status, created_at, value_eur, closed_at";
const DEAL_COLUMNS_WITH_COMPANY = `${DEAL_COLUMNS}, companies(name)`;

interface DealRow {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  status: DealStatus;
  created_at: string;
  value_eur: number | null;
  closed_at: string | null;
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
    value_eur: row.value_eur,
    closed_at: row.closed_at,
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
    .select(DEAL_COLUMNS_WITH_COMPANY)
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
    .select(DEAL_COLUMNS_WITH_COMPANY)
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
    .select(DEAL_COLUMNS)
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

  // closed_at is stamped here rather than by a trigger, so the one place
  // that changes status is also the one place that dates it. Moving a deal
  // back to open clears it: a deal that reopened was never closed on that
  // date, and leaving the stamp behind would feed a wrong number into the
  // conversion-time metric.
  const { data, error } = await supabase
    .from("deals")
    .update({
      status,
      closed_at: status === "open" ? null : new Date().toISOString(),
    })
    .eq("id", dealId)
    .select(DEAL_COLUMNS)
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
    .select(DEAL_COLUMNS)
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

/**
 * Sets or clears a deal's euro value. `null` clears it, which is not the
 * same as zero: an unpriced deal is left out of the pipeline totals, a
 * zero-value deal would be counted as worth nothing.
 *
 * Rejects anything that isn't a finite, non-negative number. The database
 * column is numeric(14,2), so a value past that would come back as an
 * opaque Postgres overflow rather than something a user can act on.
 */
export async function updateDealValue(
  supabase: SupabaseClient,
  dealId: string,
  valueEur: number | null,
): Promise<Deal> {
  if (valueEur !== null) {
    if (!Number.isFinite(valueEur) || valueEur < 0) {
      throw new Error("A deal value has to be a positive number, or empty.");
    }

    if (valueEur > 99_999_999_999) {
      throw new Error("That value is larger than this field can hold.");
    }
  }

  const { data, error } = await supabase
    .from("deals")
    .update({ value_eur: valueEur })
    .eq("id", dealId)
    .select(DEAL_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update deal value: ${error.message}`);
  }

  if (!data) {
    throw new Error("That deal no longer exists.");
  }

  return data as Deal;
}

/**
 * Parses what someone typed into the value box.
 *
 * Accepts the ways a European actually writes money: "12500", "12.500",
 * "12 500", "12.500,50", "€12,500.00". Returns null for an empty box
 * (meaning "no value"), and throws for anything it can't read rather than
 * guessing, because guessing wrong here quietly changes a pipeline total.
 *
 * The decimal separator is decided by whichever of "." and "," appears
 * last, since that is the one in the decimal position. "12.500" with no
 * later comma is read as twelve thousand five hundred, matching how it
 * would be written on a Dutch invoice.
 */
export function parseEuroInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/^€\s*/, "").trim();

  if (trimmed === "") {
    return null;
  }

  if (!/^[\d.,\s]+$/.test(trimmed)) {
    throw new Error("Enter a number, for example 12500 or 12.500,50");
  }

  const compact = trimmed.replace(/\s/g, "");
  const lastSeparator = Math.max(
    compact.lastIndexOf(","),
    compact.lastIndexOf("."),
  );

  // The decision is made by what follows the LAST separator, not by which
  // character it is. One or two digits after it means it is a decimal
  // point ("12.500,50", "1,234.56", "12,50"). Anything else means every
  // separator in the string is a thousands separator, which is what makes
  // "12.500" twelve and a half thousand and "1.234.567" over a million
  // rather than errors.
  const digitsAfter =
    lastSeparator === -1 ? 0 : compact.length - lastSeparator - 1;
  const hasDecimals =
    lastSeparator !== -1 && digitsAfter >= 1 && digitsAfter <= 2;

  const normalized = hasDecimals
    ? `${compact.slice(0, lastSeparator).replace(/[.,]/g, "")}.${compact.slice(lastSeparator + 1)}`
    : compact.replace(/[.,]/g, "");

  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Enter a number, for example 12500 or 12.500,50");
  }

  return Math.round(value * 100) / 100;
}

