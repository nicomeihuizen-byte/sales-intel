"use client";

import { useActionState, useState } from "react";
import {
  createContactAction,
  deleteContactAction,
  draftEmailAction,
  updateContactAction,
  type EmailDraftState,
  type FormState,
} from "@/app/companies/actions";
import { mailtoHref, profileHref, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact } from "@/lib/types";

const initialState: FormState = { error: null };
const initialDraftState: EmailDraftState = { error: null, draft: null };

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
  const [copied, setCopied] = useState<string | null>(null);

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
        <form action={draftAction} className="mt-2">
          <button
            type="submit"
            disabled={isDrafting}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isDrafting ? "Writing..." : "Write a draft"}
          </button>
          <p className="mt-2 font-mono text-[11px] text-dim">
            English, based on this deal&apos;s notes and status.
          </p>
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

          <form action={draftAction}>
            <button
              type="submit"
              disabled={isDrafting}
              className="font-mono text-xs text-dim transition-colors hover:text-accent disabled:opacity-50"
            >
              {isDrafting ? "writing..." : "write another"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  dealId,
}: {
  contact: Contact;
  dealId: string | null;
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
 * The people at one company: a scrollable list, an inline editor per
 * person, and an add form that stays collapsed until you want it.
 */
export default function ContactList({
  companyId,
  contacts,
  dealId,
}: {
  companyId: string;
  contacts: Contact[];
  dealId: string | null;
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
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm text-accent2">{"// contacts"}</h2>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="font-mono text-xs text-dim transition-colors hover:text-accent"
          >
            + add
          </button>
        )}
      </div>

      {isAdding && (
        <div className="mt-3 rounded border border-accent-dim px-3 py-3">
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
        <ul className="mt-3 flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
          {contacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} dealId={dealId} />
          ))}
        </ul>
      )}
    </section>
  );
}
