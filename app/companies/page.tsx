import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listCompaniesForUser, MAX_PROSPECTS } from "@/lib/companies";
import AppNav from "@/components/AppNav";
import NewCompanyForm from "@/components/NewCompanyForm";
import ProspectToggle from "@/components/ProspectToggle";
import TerminalShell from "@/components/TerminalShell";

// The company list: everything you have ever spoken to, and the place you
// choose the five you are working right now.
//
// This page is allowed to be long, because it is a reference. The desk is
// not, which is the whole reason the two are separate: picking here is what
// keeps the desk down to five things.

export default async function CompaniesPage() {
  const supabase = await createServerSupabaseClient();
  const companies = await listCompaniesForUser(supabase);

  const prospects = companies.filter((company) => company.prospect_since);
  const slotsFull = prospects.length >= MAX_PROSPECTS;

  // Longest-held first, matching the desk, so the two screens name the
  // same company as the one that has been sitting there too long.
  const held = [...prospects].sort((a, b) =>
    (a.prospect_since ?? "").localeCompare(b.prospect_since ?? ""),
  );

  return (
    <TerminalShell
      label="~/companies"
      maxWidthClassName="max-w-[1800px]"
      fillViewport
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-accent">
            Companies
          </h1>
          <p className="mt-1 text-sm text-muted">
            {companies.length} in the book. Pick up to {MAX_PROSPECTS} to work
            on the desk.
          </p>
        </div>
        <AppNav current="companies" />
      </div>

      {/* The five slots, always all five, so an empty one reads as capacity
          rather than as nothing being there. This is the answer to "what am
          I working on" without leaving the page you choose it from. */}
      <div className="mt-5 shrink-0 rounded border border-line bg-background/40 px-4 py-3">
        <h2 className="font-mono text-xs text-accent2">
          {"// prospects "}
          <span className="text-dim">
            {prospects.length}/{MAX_PROSPECTS}
          </span>
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {Array.from({ length: MAX_PROSPECTS }, (_, index) => {
            const company = held[index];

            return (
              <li key={company?.id ?? `slot-${index}`}>
                {company ? (
                  <Link
                    href={`/?company=${company.id}`}
                    className="block rounded border border-accent-dim bg-accent-dim/15 px-3 py-1 font-mono text-xs text-accent transition-colors hover:border-accent"
                  >
                    {company.name}
                  </Link>
                ) : (
                  <span className="block rounded border border-dashed border-line px-3 py-1 font-mono text-xs text-dim">
                    empty slot
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* The scrolling region. min-h-0 is what lets it shrink below its own
          content instead of pushing the add form off the bottom. */}
      <div className="scroll-pane mt-5 min-h-0 flex-1 overflow-y-auto rounded border border-line">
        {companies.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No companies yet. Add the first one below.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {companies.map((company) => {
              const picked = Boolean(company.prospect_since);

              return (
                <li
                  key={company.id}
                  className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-background/40 ${
                    picked ? "border-l-2 border-l-accent" : ""
                  }`}
                >
                  <Link
                    href={`/?company=${company.id}`}
                    className="group min-w-0 flex-1"
                  >
                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-accent">
                      {company.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-dim">
                      {company.deal_count} deals · {company.contact_count}{" "}
                      contacts
                    </span>
                  </Link>

                  <ProspectToggle
                    companyId={company.id}
                    picked={picked}
                    slotsFull={slotsFull}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0">
        <NewCompanyForm />
      </div>
    </TerminalShell>
  );
}
