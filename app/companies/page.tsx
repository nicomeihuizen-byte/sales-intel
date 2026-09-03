import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  getCompanyById,
  listCompaniesForUser,
  listDealsForCompany,
} from "@/lib/companies";
import { listContactsForCompany } from "@/lib/contacts";
import { listNotesForDeal } from "@/lib/notes";
import { getDealById } from "@/lib/deals";
import { signOut } from "@/app/login/actions";
import { deleteCompanyAction, deleteDealAction } from "@/app/companies/actions";
import { destructiveActionsEnabled } from "@/lib/featureFlags";
import ContactList from "@/components/ContactList";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import DealStatusPicker from "@/components/DealStatusPicker";
import NewDealInCompanyForm from "@/components/NewDealInCompanyForm";
import NewCompanyForm from "@/components/NewCompanyForm";
import NoteList from "@/components/NoteList";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";
import TerminalShell from "@/components/TerminalShell";

// Companies view: three panes across the top (companies, the selected
// company's people, its deals) and the selected deal's notes underneath,
// full width.
//
// Notes sit below rather than in a fourth column on purpose. A note is a
// paragraph of prose and the three columns above are lists; squeezing a
// timeline into a quarter of the width makes the one thing you actually
// read the hardest thing to read.
//
// Selection lives in the URL (?company=...&deal=...) rather than in client
// state, which keeps every pane a Server Component reading straight from
// Supabase. It also means a company or deal you are working on is a link
// you can bookmark, and the back button does what you expect.
//
// The separate /deals list is still there and still the place to answer
// "what needs attention today", a question this company-first view cannot
// answer by design.

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

  const selectedDeal =
    dealId && selectedCompany ? await getDealById(supabase, dealId) : null;

  // Guard against a deal id from a different company than the one
  // selected, which is what a hand-edited URL or a stale link produces.
  const dealBelongsHere =
    selectedDeal && selectedDeal.company_id === selectedCompany?.id;
  const notes = dealBelongsHere
    ? await listNotesForDeal(supabase, selectedDeal.id)
    : [];

  return (
    <TerminalShell label="~/companies" maxWidthClassName="max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-accent">
          Companies
        </h1>
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
      <p className="mt-2 text-muted">Signed in as {user?.email}.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <aside className="lg:border-r lg:border-line lg:pr-6">
          <h2 className="font-mono text-sm text-accent2">{"// list"}</h2>

          <ul className="mt-3 flex flex-col gap-1">
            {companies.length === 0 && (
              <li className="text-sm text-muted">
                No companies yet. Add one below, or create a deal.
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
                {/* Only offered on an empty company. Deleting one with
                    deals would cascade through their notes, and this
                    exists to clear up the leftover a misspelled name
                    creates, not to wipe an account. */}
                {canDelete &&
                  deals.length === 0 &&
                  contacts.length === 0 && (
                    <ConfirmDeleteButton
                      action={deleteCompanyAction}
                      hiddenFields={{ companyId: selectedCompany.id }}
                      label="remove company"
                    />
                  )}
              </div>
              <ContactList companyId={selectedCompany.id} contacts={contacts} />
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

              <ul className="mt-3 flex flex-col gap-2">
                {deals.map((deal) => {
                  const isSelected = deal.id === selectedDeal?.id;

                  return (
                    <li
                      key={deal.id}
                      className={`flex items-center gap-3 rounded border px-3 py-2.5 transition-colors ${
                        isSelected
                          ? "border-accent-dim bg-background"
                          : "border-line hover:border-accent-dim"
                      }`}
                    >
                      {/* The link and the status picker are siblings, not
                          nested: a select inside an anchor is invalid HTML
                          and the two fight over the click. Side by side
                          also means a deal can be reclassified without
                          opening it. */}
                      <Link
                        href={`/companies?company=${selectedCompany.id}&deal=${deal.id}`}
                        aria-current={isSelected ? "true" : undefined}
                        className="min-w-0 flex-1 text-sm font-medium text-foreground"
                      >
                        {deal.title}
                      </Link>
                      <DealStatusPicker
                        dealId={deal.id}
                        status={deal.status}
                      />
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
    </TerminalShell>
  );
}
