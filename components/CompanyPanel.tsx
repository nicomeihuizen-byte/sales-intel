"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { updateCompanyAction, type FormState } from "@/app/actions";
import CompanyFields from "@/components/CompanyFields";
import Overlay from "@/components/Overlay";
import { mailtoHref, profileHref, socialLabel, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Company } from "@/lib/types";

const initialState: FormState = { error: null };

/**
 * One company's details, in an overlay, readable and editable.
 *
 * Reading first and editing second, rather than opening straight into the
 * form. The daily use of this panel is looking something up - the
 * switchboard number when your contact has gone quiet, the VAT number
 * while you are writing the quote - and a form is a worse way to read a
 * value than a line of text is. Editing is a click away, which is the
 * right ratio.
 *
 * An overlay rather than a page at /companies/[id], for the same reason
 * deals open as overlays: the panes behind must not move. It also means
 * this one component serves both the companies page and the desk, which is
 * the point - the details are the same details wherever you opened them
 * from.
 */

/**
 * One labelled line, drawn only when there is something on it.
 *
 * Empty fields render nothing at all rather than a dash. A dash reads as
 * an answer ("they have no VAT number"), and on a record that fills up
 * over weeks the honest thing for a blank is silence.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  if (!children) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 font-mono text-xs text-dim sm:w-40 sm:pt-0.5">
        {label}
      </span>
      <span className="min-w-0 text-sm text-foreground">{children}</span>
    </div>
  );
}

/**
 * A link when the value parses into a safe href, plain text when it does
 * not. Never a dead or unsafe anchor: see lib/links.ts.
 */
function LinkOrText({
  href,
  children,
}: {
  href: string | null;
  children: string | null;
}) {
  if (!children) {
    return null;
  }

  if (!href) {
    return <>{children}</>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="break-all text-accent underline decoration-accent-dim underline-offset-2 hover:decoration-accent"
    >
      {children}
    </a>
  );
}

function CompanyDetails({ company }: { company: Company }) {
  const hasAny = Boolean(
    company.address ||
      company.country ||
      company.phone ||
      company.email ||
      company.website ||
      company.socials.length > 0 ||
      company.vat_number ||
      company.registration_number,
  );

  if (!hasAny) {
    return (
      <p className="text-sm text-muted">
        Nothing filled in yet beyond the name. Press edit to add the address,
        the numbers and how to reach them.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <Row label="Address">
        {company.address && (
          // The address was pasted in as a block, so it is printed as one.
          <span className="whitespace-pre-wrap">{company.address}</span>
        )}
      </Row>
      <Row label="Country">{company.country}</Row>
      <Row label="Telephone">
        <LinkOrText href={telHref(company.phone)}>{company.phone}</LinkOrText>
      </Row>
      <Row label="Email">
        <LinkOrText href={mailtoHref(company.email)}>
          {company.email}
        </LinkOrText>
      </Row>
      <Row label="Website">
        <LinkOrText href={profileHref(company.website)}>
          {company.website}
        </LinkOrText>
      </Row>
      {/* Named chips rather than one row per URL, matching the contact
          pane. A profile URL is long and says nothing you can read at a
          glance, so the network name is the link and the URL is the title
          - four profiles on one line instead of four rows of noise. */}
      <Row label="Socials">
        {company.socials.length > 0 && (
          <span className="flex flex-wrap gap-1.5">
            {company.socials.map((social) => {
              const href = profileHref(social);

              return href ? (
                <a
                  key={social}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={social}
                  className="inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-accent2 transition-colors hover:border-accent2"
                >
                  {socialLabel(social)}
                </a>
              ) : (
                <span
                  key={social}
                  title={social}
                  className="inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted"
                >
                  {socialLabel(social)}
                </span>
              );
            })}
          </span>
        )}
      </Row>
      <Row label="VAT number">{company.vat_number}</Row>
      <Row label="Registration">{company.registration_number}</Row>
    </div>
  );
}

export default function CompanyPanel({
  company,
  onClose,
  showDeskLink = false,
}: {
  company: Company;
  onClose: () => void;
  /** Offered on the companies page, pointless on the desk itself. */
  showDeskLink?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateCompanyAction.bind(null, company.id),
    initialState,
  );

  // Back to the read view on a successful save, so the panel shows what was
  // just stored rather than the boxes it was typed into. The revalidation
  // in the action is what refreshes the values behind it.
  if (useActionSuccess(state)) {
    setIsEditing(false);
  }

  return (
    <Overlay label={company.name} onClose={onClose} widthClassName="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {company.name}
        </h3>
        <div className="flex shrink-0 items-center gap-3">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="font-mono text-xs text-dim transition-colors hover:text-accent"
            >
              edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-dim transition-colors hover:text-accent"
          >
            close
          </button>
        </div>
      </div>

      <div className="mt-4">
        {isEditing ? (
          <CompanyFields
            formAction={formAction}
            state={state}
            isPending={isPending}
            company={company}
            submitLabel="Save"
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <CompanyDetails company={company} />
        )}
      </div>

      {/* Only for a company that is actually one of your five. The desk
          shows the five and their people; sending you there for a company
          that is not picked lands you on a pane with no company selected,
          which is the bug this panel exists to replace. */}
      {showDeskLink && !isEditing && company.prospect_since && (
        <Link
          href={`/?company=${company.id}`}
          className="mt-5 inline-block font-mono text-xs text-dim transition-colors hover:text-accent"
        >
          open on the desk &gt;
        </Link>
      )}
    </Overlay>
  );
}
