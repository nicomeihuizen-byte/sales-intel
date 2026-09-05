"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  createContactAction,
  createContactNoteAction,
  deleteContactAction,
  updateContactAction,
  type FormState,
} from "@/app/actions";
import EmailPanel from "@/components/EmailPanel";
import NoteBody, { noteLabel } from "@/components/NoteBody";
import { mailtoHref, profileHref, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact, Deal, Note } from "@/lib/types";

const initialState: FormState = { error: null };

const TEXT_FIELDS = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role", type: "text", required: false },
  { name: "linkedinUrl", label: "LinkedIn", type: "text", required: false },
] as const;

/**
 * A repeating field: one input per value, plus a spare empty one so there
 * is always somewhere to type the next address without pressing anything
 * first. Blank rows are dropped server-side, so the spare costs nothing.
 */
function MultiField({
  name,
  label,
  type,
  values,
}: {
  name: string;
  label: string;
  type: string;
  values: string[];
}) {
  const [rows, setRows] = useState<string[]>(
    values.length > 0 ? [...values, ""] : [""],
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs text-muted">{label}</span>
      {rows.map((value, index) => (
        <input
          // Index-keyed because the list is positional: a row's identity
          // here is "the nth box", and rows are only ever appended.
          key={`${name}-${index}`}
          name={name}
          type={type}
          defaultValue={value}
          aria-label={`${label} ${index + 1}`}
          className="rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
        />
      ))}
      <button
        type="button"
        onClick={() => setRows((current) => [...current, ""])}
        className="self-start font-mono text-xs text-dim transition-colors hover:text-accent"
      >
        {`+ another ${label.toLowerCase()}`}
      </button>
    </div>
  );
}

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
    linkedinUrl: contact?.linkedin_url ?? "",
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
  const rows: { label: string; value: string; href: string | null; external?: boolean }[] =
    [
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

  if (contact.linkedin_url) {
    rows.push({
      label: "li",
      value: contact.linkedin_url,
      href: profileHref(contact.linkedin_url),
      external: true,
    });
  }

  return (
    <>
      <p className="text-sm font-medium text-foreground">{contact.name}</p>
      {contact.role && <p className="text-xs text-muted">{contact.role}</p>}
      {rows.length > 0 && (
        <dl className="mt-2 flex flex-col gap-0.5">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="flex gap-2 text-xs">
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
          <div className="flex items-center gap-3">
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
              <p className="mt-1 font-mono text-[11px] text-dim">
                {new Date(note.created_at).toLocaleDateString()}
                {noteLabel(note) ? ` · ${noteLabel(note)}` : ""}
                {note.deal_id ? " · on a deal" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  deals,
  defaultDealId,
  notes,
  noteCount,
}: {
  contact: Contact;
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
      {isEditing ? (
        <ContactFields
          formAction={formAction}
          state={state}
          isPending={isPending}
          contact={contact}
          submitLabel="Save"
          onCancel={() => setIsEditing(false)}
        />
      ) : (
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

          <ContactNotes
            contact={contact}
            notes={notes}
            noteCount={noteCount}
          />

          {isEmailOpen && (
            <EmailPanel
              contact={contact}
              deals={deals}
              defaultDealId={defaultDealId}
              onClose={() => setIsEmailOpen(false)}
            />
          )}
        </>
      )}
    </li>
  );
}

/**
 * The people at one company: a scrolling list, an inline editor per person,
 * and an add form that stays collapsed until you want it.
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

      {isAdding && (
        <div className="mt-3 shrink-0 rounded border border-accent-dim px-3 py-3">
          <ContactFields
            formAction={formAction}
            state={state}
            isPending={isPending}
            submitLabel="Add contact"
            onCancel={() => setIsAdding(false)}
          />
        </div>
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
              noteCount={noteCountsByContact[contact.id] ?? 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
