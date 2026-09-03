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
import { listNotesForDeal } from "@/lib/notes";
import { getDealById } from "@/lib/deals";
import { computePipelineMetrics } from "@/lib/metrics";
import { signOut } from "@/app/login/actions";
import { deleteCompanyAction, deleteDealAction } from "@/app/companies/actions";
import { destructiveActionsEnabled } from "@/lib/featureFlags";
import ContactList from "@/components/ContactList";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import DealStatusPicker from "@/components/DealStatusPicker";
import DealValueField from "@/components/DealValueField";
import NewDealInCompanyForm from "@/components/NewDealInCompanyForm";
import NewCompanyForm from "@/components/NewCompanyForm";
import NoteList from "@/components/NoteList";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";
import PipelineMeters from "@/components/PipelineMeters";
import TerminalShell from "@/components/TerminalShell";

// Deal Management: three panes across the top (companies, the selected
// company's people, its deals), a preview of the selected deal underneath,
// and the pipeline panel fixed bottom right.
//
// Selection lives in the URL (?company=...&deal=...) rather than in client
// state, which keeps every pane a Server Component reading straight from
// Supabase. It also means a company or deal you are working on is a link
// you can bookmark, and the back button does what you expect.

// The deals pane shows this many and scrolls for the rest. Three is what
// fits beside the fixed pipeline panel without the two fighting for the
// same corner of the screen.
const VISIBLE_DEALS = 3;

// One deal row plus its gap, in rem. Kept as a number so the pane height
// is derived from VISIBLE_DEALS rather than a magic max-height that
// silently stops matching it.
const DEAL_ROW_REM = 3.45;

// How many recent notes appear in the preview under the deals pane. The
// full timeline is still below, so this is a reminder of where things
// stand, not a replacement for reading them.
const PREVIEW_NOTES = 2;

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
  searchParams: Promise<{ company?: string; deal?: string }>;
}

export default async function CompaniesPage({
  searchParams,
}: CompaniesPageProps) {
  const { company: companyId, deal: dealId } = await searchParams;
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

  const selectedDeal =
    dealId && selectedCompany ? await getDealById(supabase, dealId) : null;

  // Guard against a deal id from a different company than the one
  // selected, which is what a hand-edited URL or a stale link produces.
  const dealBelongsHere =
    selectedDeal && selectedDeal.company_id === selectedCompany?.id;
  const notes = dealBelongsHere
    ? await listNotesForDeal(supabase, selectedDeal.id)
    : [];
  const recentNotes = notes.slice(-PREVIEW_NOTES).reverse();

  return (
    <TerminalShell label="~/deals" maxWidthClassName="max-w-7xl">
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <aside className="lg:border-r lg:border-line lg:pr-6">
          <h2 className="font-mono text-sm text-accent2">{"// list"}</h2>

          <ul className="mt-3 flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1">
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
                dealId={dealBelongsHere ? selectedDeal.id : null}
              />
            </>
          )}
        </section>

        <section className="min-w-0">
          {selectedCompany && (
            <>
              <h2 className="font-mono text-sm text-accent2">{"// deals"}</h2>

              {deals.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                  No deals for this company yet.
                </p>
              )}

              {/* Sized to show VISIBLE_DEALS and scroll past that, rather
                  than truncating the list: a deal you cannot see is a deal
                  you forget. */}
              <ul
                className="mt-3 flex flex-col gap-2 overflow-y-auto pr-1"
                style={{ maxHeight: `${VISIBLE_DEALS * DEAL_ROW_REM}rem` }}
              >
                {deals.map((deal) => {
                  const isSelected = deal.id === selectedDeal?.id;

                  return (
                    <li
                      key={deal.id}
                      className={`flex items-center gap-2 rounded border px-3 py-2.5 transition-colors ${
                        isSelected
                          ? "border-accent-dim bg-background"
                          : "border-line hover:border-accent-dim"
                      }`}
                    >
                      {/* The link and the controls are siblings, not
                          nested: a select or a button inside an anchor is
                          invalid HTML and the two fight over the click. */}
                      <Link
                        href={`/companies?company=${selectedCompany.id}&deal=${deal.id}`}
                        aria-current={isSelected ? "true" : undefined}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
                      >
                        {deal.title}
                      </Link>
                      <DealValueField
                        dealId={deal.id}
                        valueEur={deal.value_eur}
                      />
                      <DealStatusPicker dealId={deal.id} status={deal.status} />
                      {canDelete && (
                        <ConfirmDeleteButton
                          action={deleteDealAction}
                          hiddenFields={{ dealId: deal.id }}
                          confirmLabel="remove + notes?"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>

              <NewDealInCompanyForm companyId={selectedCompany.id} />

              {/* The last couple of notes, so selecting a deal tells you
                  where it stands without scrolling to the timeline. */}
              {dealBelongsHere && selectedDeal && (
                <div className="mt-6 border-t border-line pt-4">
                  <h3 className="font-mono text-xs uppercase tracking-wide text-dim">
                    Latest on {selectedDeal.title}
                  </h3>
                  {recentNotes.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">
                      No notes on this deal yet.
                    </p>
                  ) : (
                    <ul className="mt-2 flex flex-col gap-2">
                      {recentNotes.map((note) => (
                        <li key={note.id} className="text-xs">
                          <p className="font-mono text-[11px] text-dim">
                            {new Date(note.created_at).toLocaleDateString()}
                          </p>
                          <p className="mt-0.5 line-clamp-3 text-foreground">
                            {note.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {dealBelongsHere && selectedDeal && (
        <section className="mt-10 border-t border-line pt-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {selectedDeal.title}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-dim">
                {selectedDeal.company_name}
              </p>
            </div>
            <Link
              href={`/deals/${selectedDeal.id}`}
              className="shrink-0 font-mono text-xs text-dim hover:text-accent"
            >
              open full page
            </Link>
          </div>

          <InsightPanel
            dealId={selectedDeal.id}
            dealStatus={selectedDeal.status}
          />

          <NoteForm dealId={selectedDeal.id} />

          <h3 className="mt-8 font-mono text-sm text-accent2">{"// notes"}</h3>
          <NoteList notes={notes} />
        </section>
      )}

      {/* Padding so the fixed panel never covers the last note. */}
      <div className="h-40" aria-hidden="true" />

      <PipelineMeters metrics={metrics} />
    </TerminalShell>
  );
}
