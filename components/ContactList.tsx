"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  createContactAction,
  createContactNoteAction,
  deleteContactAction,
  draftEmailAction,
  logSentEmailAction,
  updateContactAction,
  type EmailDraftState,
  type FormState,
} from "@/app/actions";
import { DRAFT_LANGUAGES } from "@/lib/draftLanguages";
import { mailtoHref, profileHref, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact, Note } from "@/lib/types";

const initialState: FormState = { error: null };
const initialDraftState: EmailDraftState = {
  error: null,
  draft: null,
  language: "en",
};

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
        <p role="alert" className="text-sm text-red-400">
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
function LanguageSelect({ id, value }: { id: string; value: string }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        Draft language
      </label>
      <select
        id={id}
        name="language"
        defaultValue={value}
        className="rounded border border-line bg-background px-2 py-1 font-mono text-xs text-muted outline-none focus:border-accent"
      >
        {Object.entries(DRAFT_LANGUAGES).map(([code, label]) => (
          <option key={code} value={code} className="text-foreground">
            {label}
          </option>
        ))}
      </select>
    </>
  );
}

/**
 * The drafted email, shown in a panel under the contact.
 *
 * Copy only, by design. Nothing here sends anything, and the subject and
 * body are separate boxes because most mail clients want them pasted into
 * different fields. The existing mailto link is untouched next to it: if
 * the draft is no good, write your own the way you always did.
 */
function EmailDraftPanel({
  contact,
  dealId,
  onClose,
}: {
  contact: Contact;
  dealId: string | null;
  onClose: () => void;
}) {
  const [state, draftAction, isDrafting] = useActionState(
    draftEmailAction.bind(null, contact.id, dealId),
    initialDraftState,
  );
  const [logState, logAction, isLogging] = useActionState(
    logSentEmailAction.bind(null, contact.id, dealId),
    initialState,
  );
  const [copied, setCopied] = useState<string | null>(null);
  // Sticky rather than the single render useActionSuccess returns: the
  // confirmation should stay while you are still looking at the draft.
  const [hasLogged, setHasLogged] = useState(false);

  if (useActionSuccess(logState)) {
    setHasLogged(true);
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      // Clipboard access can be refused (an insecure origin, a browser
      // setting). The text is on screen and selectable either way, so this
      // is worth a quiet no rather than an error banner.
      setCopied(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-accent-dim bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-xs uppercase tracking-wide text-accent2">
          Draft email
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-xs text-dim hover:text-accent"
        >
          close
        </button>
      </div>

      {!state.draft && (
        <form action={draftAction} className="mt-2 flex items-center gap-2">
          <LanguageSelect id={`lang-${contact.id}`} value={state.language} />
          <button
            type="submit"
            disabled={isDrafting}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isDrafting ? "Writing..." : "Write a draft"}
          </button>
        </form>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {state.error}
        </p>
      )}

      {state.draft && (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase text-dim">
                Subject
              </span>
              <button
                type="button"
                onClick={() => copy("subject", state.draft?.subject ?? "")}
                className="font-mono text-[11px] text-dim hover:text-accent"
              >
                {copied === "subject" ? "copied" : "copy"}
              </button>
            </div>
            <p className="mt-1 rounded border border-line bg-background px-2 py-1.5 text-sm text-foreground">
              {state.draft.subject}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase text-dim">
                Body
              </span>
              <button
                type="button"
                onClick={() => copy("body", state.draft?.body ?? "")}
                className="font-mono text-[11px] text-dim hover:text-accent"
              >
                {copied === "body" ? "copied" : "copy"}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap rounded border border-line bg-background px-2 py-1.5 text-sm text-foreground">
              {state.draft.body}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <form action={draftAction} className="flex items-center gap-2">
              <LanguageSelect
                id={`lang-again-${contact.id}`}
                value={state.language}
              />
              <button
                type="submit"
                disabled={isDrafting}
                className="font-mono text-xs text-dim transition-colors hover:text-accent disabled:opacity-50"
              >
                {isDrafting ? "writing..." : "write another"}
              </button>
            </form>

            <form action={logAction} className="ml-auto">
              <input
                type="hidden"
                name="subject"
                value={state.draft.subject}
              />
              <input type="hidden" name="body" value={state.draft.body} />
              <button
                type="submit"
                disabled={isLogging}
                className="font-mono text-xs text-accent2 transition-opacity hover:opacity-80 disabled:opacity-50"
                title="Records this in the history as an email you sent"
              >
                {isLogging ? "logging..." : "i sent this"}
              </button>
            </form>
          </div>

          {logState.error && (
            <p role="alert" className="text-xs text-red-400">
              {logState.error}
            </p>
          )}
          {!logState.error && hasLogged && (
            <p className="font-mono text-[11px] text-dim">
              Logged against {dealId ? "this contact and the deal" : "this contact"}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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
            <p role="alert" className="text-xs text-red-400">
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
              <p className="whitespace-pre-wrap text-xs text-foreground">
                {note.content}
              </p>
              <p className="mt-1 font-mono text-[11px] text-dim">
                {new Date(note.created_at).toLocaleDateString()}
                {note.kind === "email" ? " · email" : ""}
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
  dealId,
  notes,
  noteCount,
}: {
  contact: Contact;
  dealId: string | null;
  notes: Note[];
  noteCount: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
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
            <p role="alert" className="mt-1 text-xs text-red-400">
              {deleteState.error}
            </p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDrafting((open) => !open)}
              className="font-mono text-xs text-accent2 transition-colors hover:text-accent"
            >
              {isDrafting ? "hide draft" : "draft email"}
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
                className="font-mono text-xs text-dim transition-colors hover:text-red-400 disabled:opacity-50"
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

          {isDrafting && (
            <EmailDraftPanel
              contact={contact}
              dealId={dealId}
              onClose={() => setIsDrafting(false)}
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
  dealId,
  notesByContact,
  noteCountsByContact,
  headerAction,
}: {
  companyId: string;
  contacts: Contact[];
  dealId: string | null;
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
              dealId={dealId}
              notes={notesByContact[contact.id] ?? []}
              noteCount={noteCountsByContact[contact.id] ?? 0}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
