import Image from "next/image";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  countCompanyContents,
  getCompanyById,
  listDealsForCompany,
  listProspects,
  MAX_PROSPECTS,
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
import { deleteCompanyAction } from "@/app/actions";
import { destructiveActionsEnabled } from "@/lib/featureFlags";
import AppNav from "@/components/AppNav";
import ContactList from "@/components/ContactList";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import AnalyzeDealsButton from "@/components/AnalyzeDealsButton";
import DealBoard from "@/components/DealBoard";
import NewDealInCompanyForm from "@/components/NewDealInCompanyForm";
import PipelineMeters from "@/components/PipelineMeters";
import TerminalShell from "@/components/TerminalShell";

// The desk: the pipeline strip across the top, then three panes - your five
// prospects, the selected one's people, and its deals.
//
// The left pane holds prospects rather than every company you have ever
// spoken to, and that is the point of the screen. A list of everything
// gets longer every week until the screen is a filing cabinet; five is a
// week's work, and choosing which five is a decision made deliberately on
// /companies rather than by whatever happens to sort first.
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
 * "picked today", "3d", "2w" - how long a company has been sitting in the
 * five.
 *
 * The number is the nag. A prospect you picked three weeks ago and have not
 * moved is either work you are avoiding or a slot you should give back, and
 * neither of those is visible from a name on its own.
 */
function heldFor(prospectSince: string): string {
  const days = Math.floor(
    (Date.now() - new Date(prospectSince).getTime()) / 86_400_000,
  );

  if (days < 1) {
    return "today";
  }

  if (days < 14) {
    return `${days}d`;
  }

  return `${Math.floor(days / 7)}w`;
}

/**
 * Builds the confirm label for a company delete: "remove Minitab + 3
 * contacts, 1 deal, 12 notes?".
 *
 * Both halves earn their place. The name, because the company title is no
 * longer printed above this pane and a destructive confirm should never
 * make you look somewhere else to check what it is about to remove. The
 * contents, because removing a company cascades to its deals and through
 * them to their notes, and nothing else on screen says so.
 *
 * An empty company is just "remove Acme?".
 */
function describeCompanyDelete(
  name: string,
  contents: CompanyContents,
): string {
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

  return parts.length === 0
    ? `remove ${name}?`
    : `remove ${name} + ${parts.join(", ")}?`;
}

interface DeskPageProps {
  searchParams: Promise<{ company?: string }>;
}

export default async function DeskPage({ searchParams }: DeskPageProps) {
  const { company: companyId } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prospects = await listProspects(supabase);
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
    <TerminalShell label="~/desk" maxWidthClassName="max-w-[1800px]">
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

        <AppNav current="desk" />
      </div>

      <PipelineMeters metrics={metrics} />

      {/* One fixed-height row of three panes from lg up, each scrolling
          its own body. This is what stops the desk moving: the pane row is
          the same height whether a company has one contact or nine, and
          whether you have picked two prospects or five. Below lg the panes
          stack and take their natural height, where a fixed row would just
          mean two scrollbars on a phone. */}
      <div className="mt-8 grid gap-8 lg:h-[30rem] lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col lg:border-r lg:border-line lg:pr-6">
          {/* h-8 on all three pane headers. Each one carries something
              different next to its heading (a count here, two buttons on
              contacts, the Analyze button on deals), and those have
              different heights, so without a fixed height the three
              headings sit at three slightly different y positions and the
              whole desk looks slightly wrong in a way that is hard to
              point at. Change this number in all three or none. */}
          <div className="flex h-8 shrink-0 items-center justify-between gap-2">
            <h2 className="font-mono text-sm text-accent2">
              {"// prospects"}
            </h2>
            <span className="font-mono text-xs text-dim">
              {prospects.length}/{MAX_PROSPECTS}
            </span>
          </div>

          {/* Always five rows, filled or not. Rendering the empty ones
              costs nothing and buys two things: the pane is the same
              height whatever you have picked, so nothing below it moves,
              and three dashed boxes are a more honest picture of a
              half-used week than a short list is. */}
          <ul className="scroll-pane mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {Array.from({ length: MAX_PROSPECTS }, (_, index) => {
              const entry = prospects[index];

              if (!entry) {
                return (
                  <li
                    key={`empty-${index}`}
                    className="flex min-h-[4.75rem] items-center justify-center rounded border border-dashed border-line px-3 py-2"
                  >
                    <span className="font-mono text-xs text-dim">
                      empty slot
                    </span>
                  </li>
                );
              }

              const isSelected = entry.id === selectedCompany?.id;

              return (
                <li key={entry.id}>
                  <Link
                    href={`/?company=${entry.id}`}
                    aria-current={isSelected ? "true" : undefined}
                    className={`block min-h-[4.75rem] rounded px-3 py-2 transition-colors ${
                      isSelected
                        ? "border border-accent-dim bg-background text-foreground"
                        : "border border-transparent text-muted hover:border-line hover:text-foreground"
                    }`}
                  >
                    {/* Two lines at most, so a long name cannot make one
                        row taller than the rest and undo the whole
                        point of the fixed height. */}
                    <span className="line-clamp-2 block text-sm font-medium">
                      {entry.name}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2 font-mono text-xs text-dim">
                      <span>
                        {entry.deal_count} deals · {entry.contact_count}{" "}
                        contacts
                      </span>
                      {entry.prospect_since && (
                        <span title="How long this has been in your five">
                          {heldFor(entry.prospect_since)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* No add-company form here on purpose. Companies are added and
              picked on /companies; this pane is the five you chose, and a
              form that quietly grows it would undo the point of the cap. */}
          <Link
            href="/companies"
            className="mt-3 block shrink-0 font-mono text-xs text-dim transition-colors hover:text-accent"
          >
            change prospects &gt;
          </Link>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col lg:border-r lg:border-line lg:pr-6">
          {!selectedCompany ? (
            <p className="text-sm text-muted">
              Pick one of your prospects on the left to see its people and its
              deals.
            </p>
          ) : (
            <>
              {/* No company title here. The selected company is already
                  named and highlighted in the prospects pane, and a second
                  copy of it bought one row that pushed "// contacts" out of
                  line with "// prospects" and "// deals". Three panes whose
                  headings sit on the same line is worth more than a name
                  printed twice. */}

              {/* Only when there is exactly one deal. This used to pass
                  deals[0] whatever the count, so at a company with two
                  live deals a logged email silently attached itself to
                  whichever one sorted first, and the panel said "this
                  contact and the deal" without saying which. Ambiguous is
                  worse than absent: with null, the email is filed against
                  the person only, which is always true. A picker is the
                  better answer and is on the list. */}
              <ContactList
                companyId={selectedCompany.id}
                contacts={contacts}
                dealId={deals.length === 1 ? deals[0].id : null}
                notesByContact={notesByContact}
                noteCountsByContact={contactNoteCounts}
                headerAction={
                  canDelete && companyContents ? (
                    <ConfirmDeleteButton
                      action={deleteCompanyAction}
                      hiddenFields={{ companyId: selectedCompany.id }}
                      label="remove company"
                      confirmLabel={describeCompanyDelete(
                        selectedCompany.name,
                        companyContents,
                      )}
                    />
                  ) : null
                }
              />
            </>
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col">
          {selectedCompany && (
            <>
              {/* h-8, matching the other two pane headers. */}
              <div className="flex h-8 shrink-0 items-center justify-between gap-3">
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

              <div className="shrink-0">
                <NewDealInCompanyForm companyId={selectedCompany.id} />
              </div>
            </>
          )}
        </section>
      </div>
    </TerminalShell>
  );
}
