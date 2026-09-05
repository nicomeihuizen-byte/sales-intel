"use client";

import { useState } from "react";
import CompanyPanel from "@/components/CompanyPanel";
import ProspectToggle from "@/components/ProspectToggle";
import type { CompanyWithCounts } from "@/lib/companies";

/**
 * The book: every company you have ever spoken to, with the pick control
 * on each row.
 *
 * Clicking a row opens that company's details. It used to navigate to the
 * desk, which was wrong in a way worth writing down: the desk shows the
 * five you have picked, so clicking any company that was not one of them
 * landed you on a screen with an unselected company's contacts floating in
 * the middle pane and nothing in the app saying which company they
 * belonged to. The link was doing something the destination could not
 * honour. The details are what you actually wanted from a row in a
 * reference list, and for a company that IS in your five the panel offers
 * the desk link, where it works.
 *
 * A client component only because it holds "which row is open". The rows
 * themselves are still plain data handed down from the server.
 */
export default function CompanyList({
  companies,
  slotsFull,
}: {
  companies: CompanyWithCounts[];
  slotsFull: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = companies.find((company) => company.id === openId) ?? null;

  if (companies.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        No companies yet. Add the first one below.
      </p>
    );
  }

  return (
    <>
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
              {/* A button and not a link, because this opens something on
                  the page it is already on. Making it an anchor with no
                  href would take it out of the keyboard order and leave
                  the browser offering "open in new tab" for a thing that
                  has no address. */}
              <button
                type="button"
                onClick={() => setOpenId(company.id)}
                className="group min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-foreground group-hover:text-accent">
                  {company.name}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-dim">
                  {company.deal_count} deals · {company.contact_count} contacts
                </span>
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

      {/* Keyed on the id so switching from one company to another remounts
          the panel. Without it the edit form's uncontrolled inputs would
          keep the previous company's values, which is the quiet version of
          saving Oracle's address onto Minitab. */}
      {open && (
        <CompanyPanel
          key={open.id}
          company={open}
          onClose={() => setOpenId(null)}
          showDeskLink
        />
      )}
    </>
  );
}
