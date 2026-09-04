import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  countCompanyContents,
  getCompanyById,
  listCompaniesForUser,
  listDealsForCompany,
  type CompanyContents,
} from "@/lib/companies";
import { listContactsForCompany } from "@/lib/contacts";
import {
  countNotesByContact,
  listNotesForContact,
  listNotesForDeal,
} from "@/lib/notes";
import { computePipelineMetrics } from "@/lib/metrics";
import { listDealInsights } from "@/lib/insights";
import { signOut } from "@/app/login/actions";
import { deleteCompanyAction } from "@/app/companies/actions";
import { destructiveActionsEnabled } from "@/lib/featureFlags";
import ContactList from "@/components/ContactList";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import AnalyzeDealsButton from "@/components/AnalyzeDealsButton";
import DealBoard from "@/components/DealBoard";
import NewDealInCompanyForm from "@/components/NewDealInCompanyForm";
import NewCompanyForm from "@/components/NewCompanyForm";
import PipelineMeters from "@/components/PipelineMeters";
import TerminalShell from "@/components/TerminalShell";

// Deal Management: three panes across the top (companies, the selected
// company's people, its deals), a preview of the selected deal underneath,
// with the pipeline strip across the top above them.
//
// The selected company lives in the URL (?company=...), which keeps every
// pane a Server Component reading straight from Supabase and makes the
// company you are working on a link you can bookmark.
//
// A deal is NOT in the URL: it opens as an overlay over the three panes
// rather than as a fourth region that pushes them around. That is the
// difference between a control centre and a page that reflows every time
// you look at something.

/**
 * Spells out what a company delete takes with it, for the confirm button.
 * Reads as "remove company + 3 contacts, 1 deal, 12 notes?" so the two
 * cascade hops are visible at the moment of deciding, rather than
 * discovered afterwards. An empty company just says "remove company?".
 */
function describeCompanyContents(contents: CompanyContents): string {
  const parts: string[] = [];
  const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? "" : "s"}`;

  if (contents.contacts > 0) {
    parts.push(plural(contents.contacts, "contact"));
  }

  if (contents.deals > 0) {
    parts.push(plural(contents.deals, "deal"));
  }

  if (contents.notes > 0) {
    parts.push(plural(contents.notes, "note"));
  }

  return parts.length === 0 ? "company" : `company + ${parts.join(", ")}`;
}

interface CompaniesPageProps {
  searchParams: Promise<{ company?: string }>;
}

export default async function CompaniesPage({
  searchParams,
}: CompaniesPageProps) {
  const { company: companyId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const companies = await listCompaniesForUser(supabase);
  const metrics = await computePipelineMetrics(supabase);

  // Read once here and passed down, so the panes render consistently. The
  // actions check it again themselves - this only decides what is drawn.
  const canDelete = destructiveActionsEnabled();

  // An id in the URL that no longer resolves (deleted, or someone else's,
  // which RLS makes indistinguishable) falls back to showing nothing
  // selected rather than a not-found page. A stale bookmark should land
  // you in the app, not on an error.
  const selectedCompany = companyId
    ? await getCompanyById(supabase, companyId)
    : null;

  const contacts = selectedCompany
    ? await listContactsForCompany(supabase, selectedCompany.id)
    : [];
  const deals = selectedCompany
    ? await listDealsForCompany(supabase, selectedCompany.id)
    : [];

  // Only counted when the remove control is going to be drawn. Nobody
  // needs three extra queries per page load to render a button that isn't
  // there.
  const companyContents: CompanyContents | null =
    selectedCompany && canDelete
      ? await countCompanyContents(
          supabase,
          selectedCompany.id,
          deals.map((deal) => deal.id),
        )
      : null;

  // Everything the three panes need, gathered here so the panes stay
  // presentational and nothing fetches from inside a render.
  const contactNoteCounts = await countNotesByContact(
    supabase,
    contacts.map((contact) => contact.id),
  );

  const contactNoteLists = await Promise.all(
    contacts.map(async (contact) => [
      contact.id,
      await listNotesForContact(supabase, contact.id),
    ] as const),
  );
  const notesByContact = Object.fromEntries(contactNoteLists);

  const dealNoteLists = await Promise.all(
    deals.map(async (deal) => [
      deal.id,
      await listNotesForDeal(supabase, deal.id),
    ] as const),
  );
  const notesByDeal = Object.fromEntries(dealNoteLists);

  // The stored verdicts, so each deal row can show the last thing the
  // analysis said without this page making a single model call.
  const insights = deals.length > 0 ? await listDealInsights(supabase) : [];
  const insightsByDeal = Object.fromEntries(
    insights
      .filter((insight) => insight.deal_id in notesByDeal)
      .map((insight) => [insight.deal_id, insight]),
  );


  return (
    <TerminalShell label="~/deals" maxWidthClassName="max-w-[1800px]">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-accent">
            Deal Management
          </h1>
          <p className="mt-2 text-muted">Signed in as {user?.email}.</p>
        </div>

        {/* Drop your logo at public/logo.png (or .svg and change the src).
            Sized explicitly so the layout doesn't shift while it loads,
            per AGENTS.md - Images. */}
        <Image
          src="/logo.png"
          alt="meihuizen.ai"
          width={132}
          height={44}
          priority
          className="hidden h-11 w-auto opacity-90 sm:block"
        />

        <div className="flex items-center gap-4">
          <Link
            href="/deals"
            className="font-mono text-sm text-muted hover:text-accent"
          >
            all deals
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-sm text-muted hover:text-accent"
            >
              Log out
            </button>
          </form>
        </div>
      </div>

      <PipelineMeters metrics={metrics} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <aside className="lg:border-r lg:border-line lg:pr-6">
          <h2 className="font-mono text-sm text-accent2">{"// list"}</h2>

          <ul className="mt-3 flex flex-col gap-1">
            {companies.length === 0 && (
              <li className="text-sm text-muted">
                No companies yet. Add one below.
              </li>
            )}
            {companies.map((entry) => {
              const isSelected = entry.id === selectedCompany?.id;

              return (
                <li key={entry.id}>
                  <Link
                    href={`/companies?company=${entry.id}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`block rounded px-3 py-2 transition-colors ${
                      isSelected
                        ? "border border-accent-dim bg-background text-foreground"
                        : "border border-transparent text-muted hover:border-line hover:text-foreground"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {entry.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-dim">
                      {entry.deal_count} deals · {entry.contact_count} contacts
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <NewCompanyForm />
        </aside>

        <section className="min-w-0 lg:border-r lg:border-line lg:pr-6">
          {!selectedCompany ? (
            <p className="text-sm text-muted">
              Pick a company on the left to see its people and its deals.
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {selectedCompany.name}
                </h2>
                {/* The confirm names what goes with it. Removing a
                    company cascades to its deals and through them to
                    their notes, and nothing else on screen says so. */}
                {canDelete && companyContents && (
                  <ConfirmDeleteButton
                    action={deleteCompanyAction}
                    hiddenFields={{ companyId: selectedCompany.id }}
                    label="remove company"
                    confirmLabel={`remove ${describeCompanyContents(companyContents)}?`}
                  />
                )}
              </div>
              <ContactList
                companyId={selectedCompany.id}
                contacts={contacts}
                dealId={deals[0]?.id ?? null}
                notesByContact={notesByContact}
                noteCountsByContact={contactNoteCounts}
              />
            </>
          )}
        </section>

        <section className="min-w-0">
          {selectedCompany && (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-mono text-sm text-accent2">{"// deals"}</h2>
                <AnalyzeDealsButton companyId={selectedCompany.id} />
              </div>

              {deals.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No deals for this company yet.
                </p>
              ) : (
                <DealBoard
                  deals={deals}
                  insightsByDeal={insightsByDeal}
                  notesByDeal={notesByDeal}
                  canDelete={canDelete}
                />
              )}

              <NewDealInCompanyForm companyId={selectedCompany.id} />
            </>
          )}
        </section>
      </div>
    </TerminalShell>
  );
}
