"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { updateCompanyAction, type FormState } from "@/app/actions";
import CompanyFields from "@/components/CompanyFields";
import CompanyTree from "@/components/CompanyTree";
import Overlay from "@/components/Overlay";
import { mailtoHref, profileHref, socialLabel, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { CompanyIndexEntry } from "@/lib/companies";
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
    <>
      <dt className="font-mono text-xs text-dim sm:pt-[0.2rem]">{label}</dt>
      <dd className="min-w-0 text-sm leading-relaxed text-foreground">
        {children}
      </dd>
    </>
  );
}

/**
 * The column that makes the panel read as a record rather than a pile.
 *
 * Each row used to be its own flex line with a fixed-width label, which
 * put the burden of the column on every label in the list and left the
 * gutter to be re-decided each time a field was added. Declaring the two
 * tracks once, on the list, is what a definition list is for, and it is
 * why the values line up whatever the longest label happens to be.
 *
 * 8.5rem, not the 10rem the flex version used. The longest label here is
 * "Registration", and the extra rem and a half was a lake of empty space
 * beside "Email" and "Country" for no gain.
 *
 * One column below the sm breakpoint, where a 136px gutter would leave
 * nothing worth having for the value: label above, value under it.
 */
const FIELD_LIST =
  "grid gap-x-5 gap-y-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-y-2.5";

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

function CompanyDetails({
  company,
  index,
  onSelect,
}: {
  company: Company;
  index: CompanyIndexEntry[];
  /** Passed through to the tree, so a name in the group is clickable. */
  onSelect?: (companyId: string) => void;
}) {
  const hasAny = Boolean(
    company.description ||
    company.background ||
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
      <>
        <p className="text-sm text-muted">
          Nothing filled in yet beyond the name. Press edit to add what they do,
          the address, the numbers and how to reach them.
        </p>
        <div className="mt-5">
          <CompanyTree
            companyId={company.id}
            index={index}
            onSelect={onSelect}
          />
        </div>
      </>
    );
  }

  const hasProse = Boolean(company.description || company.background);

  return (
    <div>
      {/* The prose gets its own list, above the fields and spaced away from
          them, because it is a different kind of thing: everything below is
          one short value on one line, these two are paragraphs. Both lists
          declare the same two tracks, so the labels still line up across
          the gap between them and the panel reads as one column. */}
      {hasProse && (
        <dl className={`${FIELD_LIST} mb-5`}>
          {/* First, because it is the one line that makes the name mean
              something again three weeks later. */}
          <Row label="What they do">
            {company.description && (
              <span className="whitespace-pre-wrap">{company.description}</span>
            )}
          </Row>
          <Row label="Background">
            {company.background && (
              <span className="whitespace-pre-wrap">{company.background}</span>
            )}
          </Row>
        </dl>
      )}

      <dl className={FIELD_LIST}>
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
      </dl>

      {/* The group, drawn from the parent links. Renders nothing at all
          for a company standing on its own, because a heading called
          "group" over a single name is worse than no heading. */}
      <div className="mt-5 border-t border-line pt-4">
        <CompanyTree companyId={company.id} index={index} onSelect={onSelect} />
      </div>
    </div>
  );
}

export default function CompanyPanel({
  company,
  index,
  onClose,
  onSelect,
  showDeskLink = false,
}: {
  company: Company;
  /** Every company, for the group tree and the "part of" picker. */
  index: CompanyIndexEntry[];
  onClose: () => void;
  /**
   * Switch the panel to another company, given when the caller holds every
   * company and can therefore honour the request. That is the companies
   * page; the desk holds only your five, so it passes nothing and the
   * group tree stays plain text there rather than offering a link to a
   * company the destination cannot show.
   */
  onSelect?: (companyId: string) => void;
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
    // Reading closes on the backdrop and on Escape, as every panel does.
    // Editing does not: the same eight-field form as the add panel, filled
    // in from the same other browser window, and losing it to a stray click
    // is the same twenty minutes.
    <Overlay
      label={company.name}
      onClose={onClose}
      widthClassName="max-w-2xl"
      dismissible={!isEditing}
    >
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {company.name}
        </h3>
        {/* While editing, the header offers nothing. `close` beside a
            half-filled form is a discard button wearing the same clothes
            as the one on the read view, and it would be the next way to
            lose the typing this patch is about. Cancel, inside the form,
            is the deliberate way out. */}
        {!isEditing && (
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="font-mono text-xs text-dim transition-colors hover:text-accent"
            >
              edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs text-dim transition-colors hover:text-accent"
            >
              close
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        {isEditing ? (
          <CompanyFields
            formAction={formAction}
            state={state}
            isPending={isPending}
            company={company}
            index={index}
            submitLabel="Save"
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <CompanyDetails company={company} index={index} onSelect={onSelect} />
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
