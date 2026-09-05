import type { SupabaseClient } from "@supabase/supabase-js";
import { DEAL_COLUMNS } from "./deals";
import { profileHref } from "./links";
import type { Company, Deal } from "./types";

// Data-access layer for companies. Until the two-pane view existed,
// companies were only ever created as a side effect of creating a deal
// (findOrCreateCompanyId in lib/deals.ts) and never listed on their own.

/**
 * How many companies can be prospects at once.
 *
 * The number is the feature. A list of everything is a database; five is a
 * week's work. Change it here and the companies page, the desk and the
 * server action all move together.
 */
export const MAX_PROSPECTS = 5;

/**
 * Every column a Company needs to be complete, in one place.
 *
 * Three separate queries used to carry their own hardcoded list, which is
 * exactly how deals ended up rendering "€ NaN" when value_eur reached one
 * query and not the other. Same shape of bug, headed off before it lands.
 */
export const COMPANY_COLUMNS =
  "id, user_id, name, created_at, prospect_since, description, address, country, website, email, phone, socials, vat_number, registration_number, parent_id";

export interface CompanyWithCounts extends Company {
  deal_count: number;
  contact_count: number;
}

/**
 * `extends Company` rather than a second hand-written column list.
 *
 * The previous version restated all five fields here and again in
 * toCompanyWithCounts, so adding a column meant remembering three places.
 * That is the same failure the COMPANY_COLUMNS comment above describes:
 * the eight detail columns would have arrived in the query, missed the row
 * type, and turned up as undefined in the panel.
 */
interface CompanyRow extends Company {
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
    .select(`${COMPANY_COLUMNS}, deals(count), contacts(count)`)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  return ((data ?? []) as CompanyRow[]).map(toCompanyWithCounts);
}

function toCompanyWithCounts(row: CompanyRow): CompanyWithCounts {
  const { deals, contacts, ...company } = row;

  return {
    ...company,
    deal_count: countFromEmbed(deals),
    contact_count: countFromEmbed(contacts),
  };
}

/**
 * The companies currently picked as prospects, longest-held first.
 *
 * That order is deliberate. The one that has been in your five the longest
 * is the one to either move or drop, so it belongs at the top where you
 * cannot avoid it, rather than buried under whatever you picked this
 * morning.
 */
export async function listProspects(
  supabase: SupabaseClient,
): Promise<CompanyWithCounts[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(`${COMPANY_COLUMNS}, deals(count), contacts(count)`)
    .not("prospect_since", "is", null)
    .order("prospect_since", { ascending: true })
    .limit(MAX_PROSPECTS);

  if (error) {
    throw new Error(`Failed to load prospects: ${error.message}`);
  }

  return ((data ?? []) as CompanyRow[]).map(toCompanyWithCounts);
}

/**
 * How many prospects are picked right now.
 *
 * `head: true` asks Postgres for the count and no rows, which is the whole
 * question: the companies page needs to know whether the sixth toggle
 * should be available, not what the other five are called.
 */
export async function countProspects(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true })
    .not("prospect_since", "is", null);

  if (error) {
    throw new Error(`Failed to count prospects: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Picks or drops one company as a prospect.
 *
 * The cap is enforced here rather than by a database trigger, and that is a
 * real choice worth stating. A trigger would be the airtight version, but
 * it can only refuse: it would surface as a raw Postgres exception where a
 * sentence explaining that you already have five belongs. The race a
 * trigger would close needs two browsers picking a sixth prospect in the
 * same instant, which is not a thing that happens to one person working
 * their own pipeline. If this ever becomes a team tool, the trigger goes in
 * and this check stays as the friendly half.
 *
 * Dropping never fails on the cap, so you can always get back under it.
 */
export async function setProspect(
  supabase: SupabaseClient,
  companyId: string,
  picked: boolean,
): Promise<void> {
  if (picked) {
    const current = await countProspects(supabase);

    // Re-picking something already picked must not count against the cap,
    // which a double-submitted form would otherwise do.
    const { data: existing, error: readError } = await supabase
      .from("companies")
      .select("prospect_since")
      .eq("id", companyId)
      .maybeSingle();

    if (readError) {
      throw new Error(`Failed to read company: ${readError.message}`);
    }

    const alreadyPicked = Boolean(
      (existing as { prospect_since: string | null } | null)?.prospect_since,
    );

    if (!alreadyPicked && current >= MAX_PROSPECTS) {
      throw new Error(
        `You already have ${MAX_PROSPECTS} prospects. Drop one before picking another.`,
      );
    }

    if (alreadyPicked) {
      return;
    }
  }

  const { error } = await supabase
    .from("companies")
    .update({ prospect_since: picked ? new Date().toISOString() : null })
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to update prospect: ${error.message}`);
  }
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
    .select(COMPANY_COLUMNS)
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load company: ${error.message}`);
  }

  return (data as Company | null) ?? null;
}

/**
 * The four fields needed to draw a group tree, for every company at once.
 *
 * Four columns rather than COMPANY_COLUMNS because this is fetched on
 * every page that can open a company panel, and the panel needs to know
 * about companies it is not showing: to walk up to the top of the group,
 * to find the subsidiaries, and to grey out the ones you cannot pick as a
 * parent. Pulling the full record for all of them to draw a list of names
 * would be most of the row for none of the use.
 *
 * The whole set, not a subtree, and that is a deliberate limit. Postgres
 * can walk a tree properly with a recursive CTE, but PostgREST cannot call
 * one without a stored function, and one small query plus a walk in memory
 * is honest at this size. At a few hundred companies it is nothing. At ten
 * thousand it is the wrong shape, and the fix then is an RPC, not a bigger
 * select.
 */
export interface CompanyIndexEntry {
  id: string;
  name: string;
  parent_id: string | null;
  prospect_since: string | null;
}

export async function listCompanyIndex(
  supabase: SupabaseClient,
): Promise<CompanyIndexEntry[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, parent_id, prospect_since")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load the company index: ${error.message}`);
  }

  return (data ?? []) as CompanyIndexEntry[];
}

/**
 * Everything the forms can set on a company. Name is the only required
 * one, matching ContactInput: a prospect you heard about on a call has a
 * name and nothing else, and the tool should take it.
 */
export interface CompanyInput {
  name: string;
  description?: string;
  address?: string;
  country?: string;
  website?: string;
  email?: string;
  phone?: string;
  socials?: string[];
  vatNumber?: string;
  registrationNumber?: string;
  /**
   * The company this one is part of. `undefined` means the form did not
   * carry the field at all; `null` or `""` means "not part of anything",
   * which is a real answer and clears it.
   */
  parentId?: string | null;
}

/**
 * Trims everything, turns the empty fields into null, and normalizes the
 * two URL fields to a full https URL before they are stored.
 *
 * The URL half is worth being explicit about. lib/links.ts already refuses
 * to render an unsafe href, so nothing here is the security boundary - but
 * a `javascript:` URL that is silently accepted at the form and then
 * silently not rendered as a link is a value you typed, saved, and can
 * never work out why nothing happens when you click it. Refusing at the
 * point of entry means the answer arrives while you are still looking at
 * the box.
 *
 * `profileHref` does the parse for both fields, so a company website and a
 * contact's LinkedIn URL are held to exactly one rule.
 */
function normalizeCompanyInput(input: CompanyInput) {
  const blankToNull = (value: string | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  const urlOrNull = (value: string | undefined, label: string) => {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    const href = profileHref(trimmed);

    if (!href) {
      throw new Error(`That ${label} is not a web address.`);
    }

    return href;
  };

  const name = input.name.trim();

  if (!name) {
    throw new Error("A company needs a name.");
  }

  return {
    name,
    description: blankToNull(input.description),
    address: blankToNull(input.address),
    country: blankToNull(input.country),
    website: urlOrNull(input.website, "website"),
    email: blankToNull(input.email),
    phone: blankToNull(input.phone),
    // Trimmed, blanks dropped, de-duplicated, and normalized to full URLs
    // where they parse as one. Unlike `website` a bad entry here is not
    // refused: the form takes several, and failing the whole save because
    // one of five boxes holds an @handle would be the form arguing with
    // you over a field that is decoration on a link.
    socials: Array.from(
      new Set(
        (input.socials ?? [])
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
          .map((value) => profileHref(value) ?? value),
      ),
    ),
    vat_number: blankToNull(input.vatNumber),
    registration_number: blankToNull(input.registrationNumber),
  };
}

/**
 * Is another company already called this?
 *
 * `excludeId` is what makes this reusable for the edit form. Without it,
 * saving a company without touching the name field would find itself and
 * report the name as taken, which is the classic uniqueness-check bug and
 * would make the details form unusable for its most common case.
 *
 * Case-insensitive via ilike, and no wildcards in the pattern, so "Oracle"
 * collides with "oracle" and not with "Oracle Nederland".
 */
async function assertNameIsFree(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  let query = supabase
    .from("companies")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", name);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Failed to look up company: ${error.message}`);
  }

  if (data) {
    // The stored spelling, not the one just typed. Typing "oracle" and
    // being told `"oracle" is already in your list` reads like a bug when
    // the list plainly says Oracle; naming the row that actually collided
    // is what makes the message act on.
    const clash = (data as { name: string }).name;
    throw new Error(`"${clash}" is already in your list.`);
  }
}

/**
 * "" from an unselected picker means "not part of anything", which is a
 * real answer and clears the column. Kept out of normalizeCompanyInput
 * because that function is about text fields, and this one has to be
 * checked against the database before it can be written.
 */
function normalizeParentId(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.trim() : null;
  return trimmed ? trimmed : null;
}

/**
 * How far up a group chain this will walk before giving up.
 *
 * Not a business rule. It is a stop on a loop that reads rows the caller
 * supplied ids for, so that a cycle already sitting in the data (written
 * by a direct SQL edit, or by a future bug in here) costs one refused save
 * rather than an endless run of queries.
 */
const MAX_GROUP_DEPTH = 32;

/**
 * Checks that `parentId` is a company this user can actually be part of.
 *
 * Three separate refusals, and each one has a reason:
 *
 * 1. **Itself.** Trivial, and the first thing a double-click finds.
 * 2. **A company that does not read back.** RLS makes another user's row
 *    invisible to a select but NOT to a foreign key, which is checked
 *    below the policy layer. So without this, a guessed UUID would be
 *    accepted into `parent_id` and then render as an empty branch forever.
 *    Reading the parent first is what keeps the graph inside one tenant.
 * 3. **A descendant.** Making Ober-Haus the parent of Kiinteistömaailma
 *    while Kiinteistömaailma is already the parent of Ober-Haus produces a
 *    cycle, and every walk over the group afterwards runs until something
 *    stops it. This is caught by climbing from the proposed parent to the
 *    top: if the company being edited turns up on the way, the edge would
 *    close a loop.
 *
 * The climb is one query per level, which is fine for depth measured in
 * single digits and is only paid when a parent is actually being set.
 */
async function assertParentIsUsable(
  supabase: SupabaseClient,
  companyId: string | null,
  parentId: string,
): Promise<void> {
  if (companyId && parentId === companyId) {
    throw new Error("A company cannot be part of itself.");
  }

  let cursor: string | null = parentId;

  for (let step = 0; step < MAX_GROUP_DEPTH; step += 1) {
    if (!cursor) {
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .select("id, parent_id")
      .eq("id", cursor)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check the group: ${error.message}`);
    }

    if (!data) {
      throw new Error("That company is not in your list.");
    }

    const row = data as { id: string; parent_id: string | null };

    if (companyId && row.parent_id === companyId) {
      throw new Error(
        "That would put the company inside one of its own subsidiaries.",
      );
    }

    cursor = row.parent_id;
  }

  throw new Error(
    "That group is nested too deeply to check. Clear a parent first.",
  );
}

/**
 * Creates a company with no deal attached. The deal form still creates
 * companies implicitly, but a prospect you have only spoken to needs to
 * exist before there is anything to call a deal.
 */
export async function createCompany(
  supabase: SupabaseClient,
  userId: string,
  input: CompanyInput,
): Promise<Company> {
  const fields = normalizeCompanyInput(input);
  const parentId = normalizeParentId(input.parentId);

  await assertNameIsFree(supabase, userId, fields.name);

  // A brand new company has no subsidiaries, so the only cycle it could
  // form is with itself, and it has no id yet. The check still runs
  // because it is also what keeps a guessed parent id from another tenant
  // out of the column.
  if (parentId) {
    await assertParentIsUsable(supabase, null, parentId);
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ user_id: userId, ...fields, parent_id: parentId })
    .select(COMPANY_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create company: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as Company;
}

/**
 * Saves the details on an existing company.
 *
 * Every field is written on every save, including the ones left empty, so
 * clearing a box clears the column. A partial update would mean there is
 * no way to remove a phone number that has changed, which is worse than
 * useless on the field most likely to go stale.
 *
 * `prospect_since` is deliberately not here. Whether a company is one of
 * your five is a decision made with the toggle on the companies page, not
 * a property you edit in a details form, and letting this write it would
 * be a second route past the cap in setProspect.
 */
export async function updateCompany(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  input: CompanyInput,
): Promise<Company> {
  const fields = normalizeCompanyInput(input);
  const parentId = normalizeParentId(input.parentId);

  await assertNameIsFree(supabase, userId, fields.name, companyId);

  if (parentId) {
    await assertParentIsUsable(supabase, companyId, parentId);
  }

  const { data, error } = await supabase
    .from("companies")
    .update({ ...fields, parent_id: parentId })
    .eq("id", companyId)
    .select(COMPANY_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to save company: ${error.message}`);
  }

  // RLS turns "someone else's company" into zero rows updated rather than
  // an error, so an empty result here is the case worth naming out loud.
  if (!data) {
    throw new Error("That company no longer exists.");
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
    .select(DEAL_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load deals for company: ${error.message}`);
  }

  return (data ?? []) as Deal[];
}

export interface CompanyContents {
  deals: number;
  contacts: number;
  notes: number;
}

/**
 * How much would disappear with this company. Used to spell out the blast
 * radius on the confirm button rather than to block anything.
 *
 * Notes are counted through their deals, since notes hang off deals and
 * deals hang off the company. Two cascade hops is exactly why the number
 * is worth showing: nothing on screen otherwise says that removing a
 * company takes a note history with it.
 */
export async function countCompanyContents(
  supabase: SupabaseClient,
  companyId: string,
  dealIds: string[],
): Promise<CompanyContents> {
  const { count: contactCount, error: contactError } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (contactError) {
    throw new Error(`Failed to count contacts: ${contactError.message}`);
  }

  let noteCount = 0;

  if (dealIds.length > 0) {
    const { count, error } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .in("deal_id", dealIds);

    if (error) {
      throw new Error(`Failed to count notes: ${error.message}`);
    }

    noteCount = count ?? 0;
  }

  return {
    deals: dealIds.length,
    contacts: contactCount ?? 0,
    notes: noteCount,
  };
}

/**
 * Deletes a company, and by the cascades on `deals.company_id` and
 * `notes.deal_id`, its deals and their notes with it.
 *
 * An earlier version refused unless the company was empty. That was the
 * wrong call: it is his data, on his machine, backed up, and being told
 * "delete these three things first" by your own tool is a tool arguing
 * with you. The protection that stays is the one that informs rather than
 * forbids - the confirm button names exactly what is about to go, and it
 * still takes two clicks.
 *
 * Callers must check destructiveActionsEnabled() first. This is the
 * mechanism, not the policy.
 */
export async function deleteCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId);

  if (error) {
    throw new Error(`Failed to delete company: ${error.message}`);
  }
}
