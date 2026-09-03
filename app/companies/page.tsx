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
import ContactList from "@/components/ContactList";
import NewCompanyForm from "@/components/NewCompanyForm";
import NoteList from "@/components/NoteList";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";
import TerminalShell from "@/components/TerminalShell";
import type { DealStatus } from "@/lib/types";

// Companies view: the list on the left, the selected company's people and
// deals on the right, and the selected deal's notes below those.
//
// Selection lives in the URL (?company=...&deal=...) rather than in client
// state, which keeps every pane a Server Component that reads straight
// from Supabase. It also means a company or a deal you are working on is a
// link you can bookmark, and the back button does what you expect.
//
// The separate /deals list is still there and still the place to answer
// "what needs attention today", a question this company-first view cannot
// answer by design.

const STATUS_LABEL: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

const STATUS_STYLE: Record<DealStatus, string> = {
  open: "text-accent",
  won: "text-violet-400",
  lost: "text-muted",
};

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
    <TerminalShell label="~/companies" maxWidthClassName="max-w-6xl">
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

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <aside className="md:border-r md:border-line md:pr-6">
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

        <section className="min-w-0">
          {!selectedCompany && (
            <p className="text-sm text-muted">
              Pick a company on the left to see its people and its deals.
            </p>
          )}

          {selectedCompany && (
            <>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {selectedCompany.name}
              </h2>

              <ContactList
                companyId={selectedCompany.id}
                contacts={contacts}
              />

              <section className="mt-8">
                <h2 className="font-mono text-sm text-accent2">
                  {"// deals"}
                </h2>

                {deals.length === 0 && (
                  <p className="mt-3 text-sm text-muted">
                    No deals for this company yet. Add one from the deals
                    view.
                  </p>
                )}

                <ul className="mt-3 flex flex-col gap-2">
                  {deals.map((deal) => {
                    const isSelected = deal.id === selectedDeal?.id;

                    return (
                      <li key={deal.id}>
                        <Link
                          href={`/companies?company=${selectedCompany.id}&deal=${deal.id}`}
                          aria-current={isSelected ? "true" : undefined}
                          className={`flex items-center justify-between rounded border px-4 py-3 transition-colors ${
                            isSelected
                              ? "border-accent-dim bg-background"
                              : "border-line hover:border-accent-dim"
                          }`}
                        >
                          <span className="font-medium text-foreground">
                            {deal.title}
                          </span>
                          <span
                            className={`font-mono text-xs uppercase ${STATUS_STYLE[deal.status as DealStatus]}`}
                          >
                            {STATUS_LABEL[deal.status as DealStatus]}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {dealBelongsHere && selectedDeal && (
                <section className="mt-8 border-t border-line pt-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {selectedDeal.title}
                    </h2>
                    <Link
                      href={`/deals/${selectedDeal.id}`}
                      className="font-mono text-xs text-dim hover:text-accent"
                    >
                      open full page
                    </Link>
                  </div>

                  <InsightPanel
                    dealId={selectedDeal.id}
                    dealStatus={selectedDeal.status}
                  />

                  <NoteForm dealId={selectedDeal.id} />

                  <h3 className="mt-8 font-mono text-sm text-accent2">
                    {"// notes"}
                  </h3>
                  <NoteList notes={notes} />
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </TerminalShell>
  );
}
