import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";

// Public one-click entry point for the "Live demo" link on the portfolio
// site. Signs the visitor in as the demo account without the password ever
// reaching the browser: SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD are
// server-only env vars (the same pair scripts/seed.ts uses locally), read
// here and never returned in the response. Safe to expose publicly, since
// the demo account only ever holds seeded, fake data - see scripts/seed.ts.
//
// Needs SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD set as Production
// environment variables in Vercel, not just in .env.local - this route
// runs on the deployed server, not on a developer's machine.
export async function GET() {
  const email = process.env.SEED_DEMO_EMAIL;
  const password = process.env.SEED_DEMO_PASSWORD;

  if (!email || !password) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect("/login");
  }

  await clearStoredAnalyses(supabase, data.user.id);

  // Land on a company with something to read rather than on an empty desk.
  // A visitor who arrives at "pick a prospect on the left" has to guess
  // which one is worth opening, and the whole point of the demo is that
  // they press Analyze inside the first ten seconds.
  redirect(`/?company=${await demoLandingCompanyId(supabase)}`);
}

/**
 * Hands every visitor an un-analysed pipeline.
 *
 * The demo is one shared account, so a stored analysis outlives the person
 * who ran it. The second visitor arrived to find every deal already carrying
 * a verdict, the strip reading "6 of 6 analysed", and Analyze reduced to a
 * button that appears to do nothing because the answer is already on screen.
 * The one thing the demo exists to show was spent by whoever came first.
 *
 * Clearing on the way in, rather than on a schedule, is what makes it
 * reliable: a schedule still leaves the second visitor of any given hour
 * looking at the first visitor's leftovers.
 *
 * Deliberately only the analyses. Notes, deals and companies are the
 * material the analysis reads, and wiping those would leave nothing to
 * analyse at all.
 *
 * A failure here is not worth a broken login. If the delete does not land,
 * the visitor sees a pre-analysed demo, which is the situation this fixes
 * rather than a new one it creates.
 */
async function clearStoredAnalyses(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): Promise<void> {
  try {
    await supabase.from("deal_insights").delete().eq("user_id", userId);
  } catch {
    // fall through: a stale verdict is a worse demo, not a broken one
  }
}

/**
 * Which company the demo opens on.
 *
 * Resolved at request time rather than hardcoded as a UUID, because
 * `npm run seed` wipes and reinserts the demo data and every company gets a
 * fresh id. A pasted id works until the next reseed and then silently sends
 * every visitor to an empty desk, which is the worst kind of broken: the
 * page still loads.
 *
 * Only a picked prospect qualifies, in both branches below. The desk shows
 * the five and nothing else, so a company that is not one of them lands on
 * a desk with no company selected: the visitor's first screen would be the
 * empty state, and the demo would open one level less deep than the plain
 * desk it was supposed to improve on. Anything that puts an id in this
 * URL has to honour the same rule as the links in the app.
 *
 * Order of preference:
 *   1. DEMO_COMPANY, a company NAME set in the environment. Names survive
 *      reseeding; ids do not.
 *   2. The prospect with the most notes, which is the one with the most for
 *      the analysis to chew on and therefore the best first impression.
 *
 * Returns an empty string if neither resolves, which lands on the normal
 * desk. A demo that opens one level less deep is a worse demo, not a
 * broken one.
 */
async function demoLandingCompanyId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
): Promise<string> {
  const preferred = process.env.DEMO_COMPANY?.trim();

  if (preferred) {
    const { data } = await supabase
      .from("companies")
      .select("id")
      .ilike("name", preferred)
      .not("prospect_since", "is", null)
      .limit(1)
      .maybeSingle();

    const id = (data as { id: string } | null)?.id;

    if (id) {
      return id;
    }
  }

  const { data: prospectRows } = await supabase
    .from("companies")
    .select("id")
    .not("prospect_since", "is", null);

  const prospectIds = ((prospectRows ?? []) as { id: string }[]).map(
    (row) => row.id,
  );

  if (prospectIds.length === 0) {
    return "";
  }

  // notes -> deals -> companies, narrowed to the five. Counting through the
  // join rather than storing a tally keeps this honest when the seed
  // changes.
  const { data: rows } = await supabase
    .from("deals")
    .select("company_id, notes(count)")
    .in("company_id", prospectIds);

  const totals = new Map<string, number>();

  for (const row of (rows ?? []) as {
    company_id: string;
    notes: { count: number }[] | null;
  }[]) {
    const count = row.notes?.[0]?.count ?? 0;
    totals.set(row.company_id, (totals.get(row.company_id) ?? 0) + count);
  }

  let best = "";
  let bestCount = -1;

  for (const [companyId, count] of totals) {
    if (count > bestCount) {
      best = companyId;
      bestCount = count;
    }
  }

  return best;
}
