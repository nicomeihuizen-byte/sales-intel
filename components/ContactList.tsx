"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  createContactAction,
  createContactNoteAction,
  deleteContactAction,
  moveContactAction,
  updateContactAction,
  type FormState,
} from "@/app/actions";
import ConfidentialToggle from "@/components/ConfidentialToggle";
import EmailPanel from "@/components/EmailPanel";
import MultiField from "@/components/MultiField";
import Overlay from "@/components/Overlay";
import NoteBody, { noteLabel } from "@/components/NoteBody";
import { mailtoHref, profileHref, socialLabel, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact, Deal, Note } from "@/lib/types";
import type { CompanyIndexEntry } from "@/lib/companies";

const initialState: FormState = { error: null };

const TEXT_FIELDS = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role", type: "text", required: false },
  // Where they sit. Short on purpose: a city, or an office name. It earns
  // a field of its own because "Region Manager" at a company with seven
  // offices is not enough to know who you are calling, and the alternative
  // was people writing it into the role, where nothing can read it.
  { name: "location", label: "Location", type: "text", required: false },
] as const;

function ContactFields({
  formAction,
  state,
  isPending,
  contact,
  submitLabel,
  onCancel,
}: {
  formAction: (formData: FormData) => void;
  state: FormState;
  isPending: boolean;
  contact?: Contact;
  submitLabel: string;
  onCancel: () => void;
}) {
  const defaults: Record<string, string> = {
    name: contact?.name ?? "",
    role: contact?.role ?? "",
    location: contact?.location ?? "",
  };

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {TEXT_FIELDS.map((field) => (
        <label
          key={field.name}
          className="flex flex-col gap-1 font-mono text-xs text-muted"
        >
          {field.label}
          <input
            name={field.name}
            type={field.type}
            required={field.required}
            defaultValue={defaults[field.name]}
            className="rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
          />
        </label>
      ))}

      {/* The block, for the person who is not at the company address: a
          broker in a regional office, a consultant at their own premises.
          Most contacts leave it empty and that is correct, which is why it
          sits below the three short fields rather than among them. */}
      <label className="flex flex-col gap-1 font-mono text-xs text-muted">
        Address
        <textarea
          name="address"
          rows={2}
          defaultValue={contact?.address ?? ""}
          placeholder="Only if it differs from the company"
          className="rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
        />
      </label>

      <MultiField
        name="emails"
        label="Email"
        type="email"
        values={contact?.emails ?? []}
      />
      <MultiField
        name="phones"
        label="Phone"
        type="tel"
        values={contact?.phones ?? []}
      />
      {/* One box called LinkedIn was a schema arguing with the person
          filling it in, and they win by pasting an X profile into it. The
          network is read off the URL instead, so the label is always true
          of the value under it. */}
      <MultiField
        name="socials"
        label="Social"
        type="text"
        values={contact?.socials ?? []}
        placeholder="linkedin.com/in/... or x.com/..."
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-sm text-muted hover:text-accent"
        >
          cancel
        </button>
      </div>
    </form>
  );
}

/**
 * One contact's details. Every link goes through lib/links.ts first, which
 * returns null for anything whose scheme isn't allowed, in which case the
 * value renders as plain text instead of a link (see AGENTS.md - HTML and
 * JavaScript Security Hardening).
 */
function ContactDetails({ contact }: { contact: Contact }) {
  const rows: {
    label: string;
    value: string;
    href: string | null;
    external?: boolean;
  }[] = [
    ...contact.emails.map((email) => ({
      label: "email",
      value: email,
      href: mailtoHref(email),
    })),
    ...contact.phones.map((phone) => ({
      label: "phone",
      value: phone,
      href: telHref(phone),
    })),
  ];

  return (
    <>
      <p className="text-sm font-medium text-foreground">{contact.name}</p>
      {contact.role && <p className="text-xs text-muted">{contact.role}</p>}
      {/* Location beside the role rather than down with the address,
          because it is read while deciding who to call and the address is
          read once a year. */}
      {contact.location && (
        <p className="font-mono text-xs text-dim">{contact.location}</p>
      )}
      {contact.address && (
        <p className="mt-1 whitespace-pre-wrap text-xs text-muted">
          {contact.address}
        </p>
      )}

      {/* Socials sit apart from the addresses and phone numbers, as named
          chips rather than rows.

          A profile URL is long and carries no information you can read at
          a glance - `linkedin.com/in/nico-meihuizen-1a2b3c4` in a pane this
          narrow is a line of noise that tells you only "LinkedIn". So the
          name is the link and the URL is the title attribute, which puts
          four profiles on one line where four rows would have cost four.
          The name is read off the URL (socialLabel), so it cannot disagree
          with where the link actually goes. */}
      {contact.socials.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {contact.socials.map((social) => {
            const href = profileHref(social);
            const label = socialLabel(social);

            return (
              <li key={social}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social}
                    className="inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-accent2 transition-colors hover:border-accent2"
                  >
                    {label}
                  </a>
                ) : (
                  // Not a URL - an @handle, most likely. Still worth
                  // showing, just not as something to click.
                  <span
                    title={social}
                    className="inline-block rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > 0 && (
        <dl className="mt-2 flex flex-col gap-0.5">
          {rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="flex gap-2 text-xs"
            >
              <dt className="w-10 shrink-0 font-mono text-dim">{row.label}</dt>
              <dd className="min-w-0 break-words">
                {row.href ? (
                  <a
                    href={row.href}
                    className="text-accent2 hover:underline"
                    target={row.external ? "_blank" : undefined}
                    rel={row.external ? "noopener noreferrer" : undefined}
                  >
                    {row.value}
                  </a>
                ) : (
                  <span className="text-muted">{row.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

/**
 * The language picker for a draft. Its own component only because it
 * appears twice, once on the empty panel and once beside "write another",
 * and the two must stay in step.
 */
/**
 * Notes attached to one person, with no deal involved.
 *
 * Deliberately not a third pane: only four section labels exist on this
 * screen and a person's notes belong to that person, not beside them. The
 * list stays collapsed behind a count, because most contacts have none and
 * a permanently open empty list is noise in a column you scan.
 *
 * These notes never reach the momentum analysis, which reads only notes
 * carrying a deal_id. Talking to someone you have no deal with should not
 * be able to move a deal's health score.
 */
function ContactNotes({
  contact,
  notes,
  noteCount,
}: {
  contact: Contact;
  notes: Note[];
  noteCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createContactNoteAction.bind(null, contact.id),
    initialState,
  );

  if (useActionSuccess(state)) {
    setIsAdding(false);
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="font-mono text-xs text-dim transition-colors hover:text-accent"
        >
          {noteCount === 0
            ? "no notes"
            : `${noteCount} note${noteCount === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            setIsOpen(true);
          }}
          className="font-mono text-xs text-dim transition-colors hover:text-accent"
        >
          + note
        </button>
      </div>

      {isAdding && (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor={`contact-note-${contact.id}`}>
            Note about {contact.name}
          </label>
          <textarea
            id={`contact-note-${contact.id}`}
            name="content"
            required
            rows={3}
            autoFocus
            placeholder={`What was said with ${contact.name}?`}
            className="rounded border border-line bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
          />
          {state.error && (
            <p role="alert" className="text-xs text-danger">
              {state.error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="font-mono text-xs text-muted hover:text-accent"
            >
              cancel
            </button>
            <label className="flex items-center gap-2 font-mono text-[11px] text-dim">
              <input
                type="checkbox"
                name="confidential"
                className="accent-[var(--accent)]"
              />
              keep out of the analysis
            </label>
          </div>
        </form>
      )}

      {isOpen && notes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded border border-line bg-background/40 px-2 py-1.5"
            >
              {/* Five lines and a way in. A pasted email body rendered in
                  full here would turn this pane into a wall of text, and
                  the pane's fixed height is the thing that stops the whole
                  desk moving when you click between companies. */}
              <NoteBody note={note} className="text-xs text-foreground" />
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="font-mono text-[11px] text-dim">
                  {new Date(note.created_at).toLocaleDateString()}
                  {noteLabel(note) ? ` · ${noteLabel(note)}` : ""}
                  {note.deal_id ? " · on a deal" : ""}
                </p>
                <ConfidentialToggle note={note} compact />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Moves one contact to another company.
 *
 * Its own control and its own form, sitting beside edit and remove rather
 * than inside the edit form. Moving a person is a different act from
 * correcting their phone number: a company picker among the other fields
 * would relocate somebody the first time a stray keystroke landed on a
 * select, and nothing on the screen would say so until they went missing.
 *
 * Closed until asked for, because it is the rarest thing you do to a
 * contact and a permanently visible select would take a line of a pane
 * that has none to spare.
 *
 * The current company is not in the list. "Move to where they already
 * are" is not an answer, and offering it is how a control invites a click
 * that does nothing.
 */
function MoveContact({
  contact,
  companyIndex,
}: {
  contact: Contact;
  companyIndex: CompanyIndexEntry[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    moveContactAction,
    initialState,
  );

  const targets = companyIndex.filter(
    (entry) => entry.id !== contact.company_id,
  );

  // Nothing to move them to. One company in the book is the normal state
  // on day one, and a control that can only fail is worse than no control.
  if (targets.length === 0) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        move
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="contactId" value={contact.id} />
      <select
        name="companyId"
        defaultValue=""
        className="rounded border border-line bg-background px-1.5 py-0.5 font-mono text-xs text-foreground outline-none focus:border-accent"
      >
        <option value="">move to...</option>
        {targets.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="font-mono text-xs text-accent2 transition-colors hover:text-accent disabled:opacity-50"
      >
        {isPending ? "moving..." : "move"}
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        cancel
      </button>
      {state.error && (
        <p role="alert" className="w-full text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

function ContactRow({
  contact,
  companyIndex,
  deals,
  defaultDealId,
  notes,
  noteCount,
}: {
  contact: Contact;
  /** Every company, for the move picker on this row. */
  companyIndex: CompanyIndexEntry[];
  deals: Deal[];
  defaultDealId: string | null;
  notes: Note[];
  noteCount: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateContactAction.bind(null, contact.id),
    initialState,
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteContactAction,
    initialState,
  );

  if (useActionSuccess(state)) {
    setIsEditing(false);
  }

  return (
    <li className="rounded border border-line px-3 py-2.5">
      {/* Editing pops out as well, and it has to: it is the same form as
          the add pane, so leaving it inline would swap one card in a
          scrolling column for something taller than the column, and take
          every row below it out of view while you typed.

          The card underneath keeps rendering, so the pane does not jump
          when the overlay closes. */}
      {isEditing && (
        <Overlay
          label={`Edit ${contact.name}`}
          onClose={() => setIsEditing(false)}
          widthClassName="max-w-xl"
          dismissible={false}
        >
          <h3 className="font-display text-lg font-semibold text-foreground">
            {contact.name}
          </h3>

          <div className="mt-4">
            <ContactFields
              formAction={formAction}
              state={state}
              isPending={isPending}
              contact={contact}
              submitLabel="Save"
              onCancel={() => setIsEditing(false)}
            />
          </div>
        </Overlay>
      )}

      <>
        <ContactDetails contact={contact} />
        {deleteState.error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {deleteState.error}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3">
          {/* "email", not "draft email". The panel behind it does one
                thing, put an email on the record, and drafting is only one
                of the two ways in - the label used to name the way in that
                happens to involve the model, which is how logging what you
                actually sent ended up hidden inside it. */}
          <button
            type="button"
            onClick={() => setIsEmailOpen((open) => !open)}
            className="font-mono text-xs text-accent2 transition-colors hover:text-accent"
          >
            {isEmailOpen ? "hide email" : "email"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="font-mono text-xs text-dim transition-colors hover:text-accent"
          >
            edit
          </button>
          <MoveContact contact={contact} companyIndex={companyIndex} />
          <form action={deleteAction}>
            <input type="hidden" name="contactId" value={contact.id} />
            <button
              type="submit"
              disabled={isDeleting}
              className="font-mono text-xs text-dim transition-colors hover:text-danger disabled:opacity-50"
            >
              {isDeleting ? "removing..." : "remove"}
            </button>
          </form>
        </div>

        <ContactNotes contact={contact} notes={notes} noteCount={noteCount} />

        {isEmailOpen && (
          <EmailPanel
            contact={contact}
            deals={deals}
            defaultDealId={defaultDealId}
            onClose={() => setIsEmailOpen(false)}
          />
        )}
      </>
    </li>
  );
}

/**
 * The people at one company: a scrolling list, with the add form and the
 * per-person editor both popping out over it.
 *
 * They pop out because the form outgrew the pane. Contacts get a column on
 * the desk, not a page, and once a contact carried a location, an address
 * and three repeating lists, an inline form was taller than the space it
 * had: the Save button sat below the fold with no scrollbar of its own, so
 * the form could be filled in and not saved. An overlay has the whole
 * viewport and the pane behind it never moves.
 *
 * The list is the pane's scroll region rather than something that grows to
 * fit. A company with one contact and a company with six used to make the
 * whole desk a different height, so switching between them moved every
 * other pane on the screen. About two cards are visible at a time now and
 * the rest scroll.
 *
 * The header and the add form sit outside the scroll region on purpose:
 * "+ add" should be where you left it however far down the list you are.
 */
export default function ContactList({
  companyId,
  companyIndex,
  contacts,
  deals,
  defaultDealId,
  notesByContact,
  noteCountsByContact,
  headerAction,
}: {
  companyId: string;
  contacts: Contact[];
  /**
   * Every deal at this company, for the picker in the email panel.
   *
   * Closed deals are in the list on purpose. An email arriving after a
   * deal was marked lost is exactly the kind of thing worth filing
   * against it, and it is what the loss review reads.
   */
  deals: Deal[];
  /**
   * Which deal the picker starts on. Still null when the company has more
   * than one open deal: a guess would be filed silently, and the picker
   * is now there to be answered.
   */
  defaultDealId: string | null;
  notesByContact: Record<string, Note[]>;
  /**
   * Every company the user has, for the move picker on each row. Handed
   * down from the page rather than fetched here: this is a client
   * component, and the desk already loads the index for the group tree.
   */
  companyIndex: CompanyIndexEntry[];
  noteCountsByContact: Record<string, number>;
  /**
   * Rendered at the far right of the `// contacts` header.
   *
   * The company's remove control lives here now, because the company title
   * that used to carry it is gone: the selected company is already named
   * and highlighted in the prospects pane, and a second copy of the name
   * bought nothing except a row that pushed this pane's heading out of
   * line with the other two.
   *
   * Passed in as a slot rather than built here, so this stays a component
   * about people and knows nothing about deleting companies.
   *
   * Whatever is passed needs a `key`. It lands beside "+ add" in a
   * two-item child array, and an element created in a Server Component and
   * serialized across to here does not get the static-children exemption
   * that hand-written JSX does, so React asks it for one.
   */
  headerAction?: ReactNode;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createContactAction.bind(null, companyId),
    initialState,
  );

  if (useActionSuccess(state)) {
    setIsAdding(false);
  }

  return (
    // No top margin. This section used to sit under the company title and
    // needed clearing from it; with the title gone, a margin here just
    // pushes "// contacts" 24px below the headings in the other two panes.
    <section className="flex min-h-0 flex-1 flex-col">
      {/* h-8, matching the pane headers in app/page.tsx. */}
      <div className="flex h-8 shrink-0 items-center justify-between gap-3">
        <h2 className="font-mono text-sm text-accent2">{"// contacts"}</h2>

        {/* "+ add" first and the destructive control last, so the one you
            press weekly is not the one nearest the edge you aim at. */}
        <div className="flex items-center gap-4">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="font-mono text-xs text-dim transition-colors hover:text-accent"
            >
              + add
            </button>
          )}
          {headerAction}
        </div>
      </div>

      {/* A pop-out, not a block above the list.

          It was a block until the form grew past what this pane can hold.
          The desk gives contacts a column, not a page, and eight fields
          plus three repeating lists is taller than that column: the Save
          button ended up below the fold with no scrollbar of its own, so
          you could type into the form and then not reach the button that
          saves it.

          Locked shut, same as the add-company form, and for the same
          reason: this gets filled in with a registry page open in another
          window, and a click on the backdrop used to take the lot. Cancel
          is the way out. */}
      {isAdding && (
        <Overlay
          label="Add a contact"
          onClose={() => setIsAdding(false)}
          widthClassName="max-w-xl"
          dismissible={false}
        >
          <h3 className="font-display text-lg font-semibold text-foreground">
            Add a contact
          </h3>
          <p className="mt-1 text-sm text-muted">
            The name is all that is required. The rest can wait until you have
            it.
          </p>

          <div className="mt-4">
            <ContactFields
              formAction={formAction}
              state={state}
              isPending={isPending}
              submitLabel="Add contact"
              onCancel={() => setIsAdding(false)}
            />
          </div>
        </Overlay>
      )}

      {contacts.length === 0 && !isAdding && (
        <p className="mt-3 text-sm text-muted">No contacts yet.</p>
      )}

      {contacts.length > 0 && (
        // pr-1 keeps the green rail off the card borders rather than
        // sitting on top of them.
        <ul className="scroll-pane mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {contacts.map((contact) => (
            <ContactRow
              key={contact.id}
              contact={contact}
              deals={deals}
              defaultDealId={defaultDealId}
              notes={notesByContact[contact.id] ?? []}
              companyIndex={companyIndex}
              noteCount={noteCountsByContact[contact.id] ?? 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
