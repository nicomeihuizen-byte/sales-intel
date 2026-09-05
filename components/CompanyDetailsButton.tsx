"use client";

import { useState } from "react";
import CompanyPanel from "@/components/CompanyPanel";
import type { CompanyIndexEntry } from "@/lib/companies";
import type { Company } from "@/lib/types";

/**
 * "company details" - the way into the same panel from the desk.
 *
 * The desk has no company title of its own (see the note in app/page.tsx
 * about the three pane headings sitting on one line), so this control
 * carries the company name in its accessible label rather than on screen.
 * A control that says only "company details" is fine when the company is
 * named and highlighted two panes to the left; a screen reader has no such
 * context, hence the aria-label.
 */
export default function CompanyDetailsButton({
  company,
  index,
}: {
  company: Company;
  /** Every company, for the group tree and the "part of" picker. */
  index: CompanyIndexEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Details for ${company.name}`}
        className="font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        company details
      </button>

      {isOpen && (
        <CompanyPanel
          company={company}
          index={index}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
