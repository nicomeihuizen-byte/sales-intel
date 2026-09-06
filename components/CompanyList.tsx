"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CompanyPanel from "@/components/CompanyPanel";
import ProspectToggle from "@/components/ProspectToggle";
import {
  STATUS_LABEL,
  STATUS_STYLE,
  MOMENTUM_EDGE,
  MOMENTUM_LABEL,
  MOMENTUM_STYLE,
  EURO,
  formatDealValue,
} from "@/lib/dealDisplay";
import type { CompanyIndexEntry, CompanyWithCounts } from "@/lib/companies";
import type { DealWithCompany } from "@/lib/deals";
import type { DealInsightView } from "@/lib/dealDisplay";
import type { DealStatus } from "@/lib/types";

/**
 * The book, in two panes: every company on the left, the selected
 * company's deals on the right.
 *
 * The second pane is the answer to a question the single list could not
 * answer. "0 deals · 3 contacts" on a row tells you a company is empty; it
 * does not tell you what the ones that are not empty are worth, and
 * checking meant leaving for /deals and coming back having lost your
 * place. With twenty companies in the book, the scan you actually do is
 * "who has nothing on them", and that is a comparison between two columns,
 * not a number on a row.
 *
 * Selecting and opening are separate, and this is the one real judgement
 * call in here. Clicking a row used to open the details overlay. Now the
 * name selects, filling the right pane, and a `details` button opens the
 * panel. The reason: with deals beside the list, the thing you do fifty
 * times an evening is look at a company's pipeline, and the thing you do
 * twice is read its VAT number. The cheap gesture should be the common
 * one. If that turns out to be the wrong way round after a week of use,
 * it is two lines to swap.
 *
 * A client component because it holds three pieces of screen state: which
 * row is selected, which panel is open, and the two sort orders. The rows
 * themselves are still plain data handed down from the server.
 */

/** How the left pane is ordered. */
type CompanySort = "name" | "empty" | "deals" | "value";

/**
 * How the right pane is ordered *within* a status group.
 *
 * "open first" used to be one of these. It went when the pane started
 * drawing open, won and lost as three sections: a sort that reorders rows
 * inside a group by the thing the group is already defined by does
 * nothing, and a control that does nothing is worse than no control.
 */
type DealSort = "value" | "unpriced" | "newest";

const COMPANY_SORTS: { value: CompanySort; label: string }[] = [
  { value: "name", label: "A-Z" },
  { value: "empty", label: "empty first" },
  { value: "deals", label: "most deals" },
  { value: "value", label: "biggest pipeline" },
];

const DEAL_SORTS: { value: DealSort; label: string }[] = [
  { value: "value", label: "biggest first" },
  { value: "unpriced", label: "unpriced first" },
  { value: "newest", label: "newest" },
];

/**
 * The order the three groups are drawn in, and the only place that order
 * is written down.
 *
 * Every status gets a section, always, even an empty one is skipped rather
 * than hidden behind a filter. "Full view" means you can see that a company
 * has one open deal and three lost ones without changing anything, because
 * three lost deals is itself the answer to whether to spend another evening
 * on them.
 */
const STATUS_GROUPS: DealStatus[] = ["open", "won", "lost"];

const selectClass =
  "rounded border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-muted outline-none focus:border-accent";

/**
 * Open pipeline per company, keyed by company id.
 *
 * Open only, and unpriced deals skipped rather than counted as zero, which
 * is the rule the pipeline strip and the deals page already follow. A won
 * deal from March is not what "biggest pipeline" is asking about.
 */
function openValueByCompany(deals: DealWithCompany[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const deal of deals) {
    if (deal.status !== "open" || deal.value_eur === null) {
      continue;
    }

    totals.set(
      deal.company_id,
      (totals.get(deal.company_id) ?? 0) + deal.value_eur,
    );
  }

  return totals;
}

export default function CompanyList({
  companies,
  deals,
  insights,
  index,
  slotsFull,
}: {
  companies: CompanyWithCounts[];
  /** Every deal the user has, grouped into the right pane on selection. */
  deals: DealWithCompany[];
  /**
   * The stored momentum read per deal, dated on the server so this client
   * component never builds a "6 days ago" of its own. See DealInsightView.
   *
   * Only open deals appear here. The insight route drops the stored row
   * when a deal is marked won or lost, so a closed deal has nothing by
   * construction, and this pane must not report that as "never analysed".
   */
  insights: DealInsightView[];
  /** Every company, for the group tree and the "part of" picker. */
  index: CompanyIndexEntry[];
  slotsFull: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    companies[0]?.id ?? null,
  );
  const [companySort, setCompanySort] = useState<CompanySort>("name");
  const [dealSort, setDealSort] = useState<DealSort>("value");

  const open = companies.find((company) => company.id === openId) ?? null;
  const selected =
    companies.find((company) => company.id === selectedId) ?? null;

  const openValues = useMemo(() => openValueByCompany(deals), [deals]);

  const insightByDeal = useMemo(
    () => new Map(insights.map((insight) => [insight.dealId, insight])),
    [insights],
  );

  // Every ordering falls back to the name, so two companies with the same
  // deal count do not swap places between renders. localeCompare and not
  // `<`, because Šapoka and Zilinskas are not in ASCII order.
  const sortedCompanies = useMemo(() => {
    const byName = (a: CompanyWithCounts, b: CompanyWithCounts) =>
      a.name.localeCompare(b.name);

    return [...companies].sort((a, b) => {
      if (companySort === "empty") {
        return a.deal_count - b.deal_count || byName(a, b);
      }

      if (companySort === "deals") {
        return b.deal_count - a.deal_count || byName(a, b);
      }

      if (companySort === "value") {
        return (
          (openValues.get(b.id) ?? 0) - (openValues.get(a.id) ?? 0) ||
          byName(a, b)
        );
      }

      return byName(a, b);
    });
  }, [companies, companySort, openValues]);

  const selectedDeals = useMemo(() => {
    if (!selected) {
      return [];
    }

    const mine = deals.filter((deal) => deal.company_id === selected.id);
    const byTitle = (a: DealWithCompany, b: DealWithCompany) =>
      a.title.localeCompare(b.title);

    return mine.sort((a, b) => {
      if (dealSort === "unpriced") {
        // Unpriced first, then the rest largest-first, so this order is
        // "what still needs a number, and after that, what matters".
        const aUnpriced = a.value_eur === null ? 0 : 1;
        const bUnpriced = b.value_eur === null ? 0 : 1;

        return (
          aUnpriced - bUnpriced ||
          (b.value_eur ?? 0) - (a.value_eur ?? 0) ||
          byTitle(a, b)
        );
      }

      if (dealSort === "newest") {
        return b.created_at.localeCompare(a.created_at) || byTitle(a, b);
      }

      // Biggest first, and an unpriced deal sorts last rather than as zero:
      // it has not been valued, so it cannot claim a place in a ranking by
      // value.
      const aValue = a.value_eur ?? Number.NEGATIVE_INFINITY;
      const bValue = b.value_eur ?? Number.NEGATIVE_INFINITY;

      return bValue - aValue || byTitle(a, b);
    });
  }, [deals, dealSort, selected]);

  if (companies.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        No companies yet. Add the first one below.
      </p>
    );
  }

  return (
    <>
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Left: the book. */}
        <div className="flex min-h-0 flex-col border-line lg:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
            <h2 className="font-mono text-xs text-accent2">
              {"// companies "}
              <span className="text-dim">{companies.length}</span>
            </h2>
            <label className="flex items-center gap-2 font-mono text-xs text-dim">
              sort
              <select
                value={companySort}
                onChange={(event) =>
                  setCompanySort(event.target.value as CompanySort)
                }
                className={selectClass}
              >
                {COMPANY_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="scroll-pane min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {sortedCompanies.map((company) => {
              const picked = Boolean(company.prospect_since);
              const isSelected = company.id === selectedId;
              const openValue = openValues.get(company.id) ?? 0;

              return (
                <li
                  key={company.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                    isSelected ? "bg-background/60" : "hover:bg-background/40"
                  } ${picked ? "border-l-2 border-l-accent" : ""}`}
                >
                  {/* Selects. A button and not a link, because this fills
                      the pane beside it on the page it is already on. */}
                  <button
                    type="button"
                    onClick={() => setSelectedId(company.id)}
                    aria-pressed={isSelected}
                    className="group min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`block truncate text-sm font-medium group-hover:text-accent ${
                        isSelected ? "text-accent" : "text-foreground"
                      }`}
                    >
                      {company.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-dim">
                      {company.deal_count} deals · {company.contact_count}{" "}
                      contacts
                      {/* Only when there is one. A company with nothing
                          open should read as empty, not as € 0. */}
                      {openValue > 0 && ` · ${EURO.format(openValue)} open`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenId(company.id)}
                    aria-label={`Details for ${company.name}`}
                    className="shrink-0 font-mono text-xs text-dim transition-colors hover:text-accent"
                  >
                    details
                  </button>

                  <ProspectToggle
                    companyId={company.id}
                    picked={picked}
                    slotsFull={slotsFull}
                  />
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: what is actually on the selected company. */}
        <div className="flex min-h-0 flex-col border-t border-line lg:border-t-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
            <h2 className="min-w-0 font-mono text-xs text-accent2">
              {"// deals "}
              <span className="truncate text-dim">
                {selected ? selected.name : "nothing selected"}
              </span>
            </h2>
            {selectedDeals.length > 1 && (
              <label className="flex items-center gap-2 font-mono text-xs text-dim">
                sort
                <select
                  value={dealSort}
                  onChange={(event) =>
                    setDealSort(event.target.value as DealSort)
                  }
                  className={selectClass}
                >
                  {DEAL_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="scroll-pane min-h-0 flex-1 overflow-y-auto">
            {selectedDeals.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                {selected
                  ? `Nothing on ${selected.name} yet.`
                  : "Pick a company on the left."}
              </p>
            ) : (
              STATUS_GROUPS.map((status) => {
                const group = selectedDeals.filter(
                  (deal) => deal.status === status,
                );

                if (group.length === 0) {
                  return null;
                }

                // Only what is still live is totalled. A "won 3 · € 91.000"
                // heading reads as pipeline at a glance, and it is not.
                const groupValue =
                  status === "open"
                    ? group.reduce(
                        (total, deal) => total + (deal.value_eur ?? 0),
                        0,
                      )
                    : null;

                return (
                  <section key={status}>
                    <h3 className="sticky top-0 z-10 border-b border-line bg-raised px-4 py-1.5 font-mono text-xs uppercase text-dim">
                      <span className={STATUS_STYLE[status]}>
                        {STATUS_LABEL[status]}
                      </span>{" "}
                      {group.length}
                      {groupValue !== null &&
                        groupValue > 0 &&
                        ` · ${EURO.format(groupValue)}`}
                    </h3>

                    <ul className="divide-y divide-line">
                      {group.map((deal) => {
                        // Gated on status, not just on presence. A lost
                        // deal that was analysed with the loss review gets
                        // no stored row, and telling him it was "not
                        // analysed yet" when he had just analysed it is
                        // the app contradicting what he watched happen.
                        const insight =
                          deal.status === "open"
                            ? insightByDeal.get(deal.id)
                            : undefined;

                        return (
                          <li key={deal.id}>
                            <Link
                              href={`/deals/${deal.id}`}
                              className={`block px-4 py-3 transition-colors hover:bg-background/40 ${
                                insight ? MOMENTUM_EDGE[insight.momentum] : ""
                              }`}
                            >
                              <span className="flex items-baseline justify-between gap-4">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                  {deal.title}
                                </span>
                                <span className="shrink-0 font-mono text-sm text-muted">
                                  {formatDealValue(deal.value_eur)}
                                </span>
                              </span>

                              {/* The stored reasoning, clamped to five
                                  lines. Clamped and not truncated at a
                                  character count: five lines is what fits
                                  beside a company list without the pane
                                  turning into an essay, and the deal page
                                  is one click away for the rest.

                                  A deal nobody has analysed says so. The
                                  alternative was leaving the space blank,
                                  which reads as "nothing to report" when
                                  the truth is "nobody has looked". */}
                              {insight && (
                                <>
                                  <span className="mt-1 block font-mono text-xs">
                                    <span
                                      className={`uppercase ${MOMENTUM_STYLE[insight.momentum]}`}
                                    >
                                      {MOMENTUM_LABEL[insight.momentum]}
                                    </span>
                                    <span className="text-dim">
                                      {" "}
                                      · {insight.age}
                                    </span>
                                  </span>
                                  <span className="mt-1 line-clamp-5 block text-xs leading-relaxed text-muted">
                                    {insight.reasoning}
                                  </span>
                                </>
                              )}
                              {!insight && deal.status === "open" && (
                                <span className="mt-1 block font-mono text-xs text-dim">
                                  not analysed yet
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Keyed on the id so switching from one company to another remounts
          the panel. Without it the edit form's uncontrolled inputs would
          keep the previous company's values, which is the quiet version of
          saving Oracle's address onto Minitab. */}
      {open && (
        <CompanyPanel
          key={open.id}
          company={open}
          index={index}
          onClose={() => setOpenId(null)}
          // Clicking a name in the group tree walks the panel to that
          // company and selects it behind, so closing the overlay leaves
          // you on the company you walked to rather than the one you
          // started from.
          onSelect={(companyId) => {
            setOpenId(companyId);
            setSelectedId(companyId);
          }}
          showDeskLink
        />
      )}
    </>
  );
}
