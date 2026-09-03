"use client";

import { useActionState, useState } from "react";
import {
  createContactAction,
  deleteContactAction,
  updateContactAction,
  type FormState,
} from "@/app/companies/actions";
import { mailtoHref, profileHref, telHref } from "@/lib/links";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact } from "@/lib/types";

const initialState: FormState = { error: null };

const FIELDS = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role", type: "text", required: false },
  { name: "email", label: "Email", type: "email", required: false },
  { name: "phone", label: "Phone", type: "tel", required: false },
  { name: "linkedinUrl", label: "LinkedIn", type: "text", required: false },
] as const;

type ContactFormValues = Partial<
  Record<(typeof FIELDS)[number]["name"], string>
>;

function contactToFormValues(contact: Contact): ContactFormValues {
  return {
    name: contact.name,
    role: contact.role ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    linkedinUrl: contact.linkedin_url ?? "",
  };
}

/**
 * The five contact fields, used for both adding and editing.
 *
 * Deliberately presentational: the caller owns the useActionState hook and
 * the open/closed state next to each other, so closing the form on success
 * is a component adjusting its own state during render rather than a child
 * reaching up into its parent, which React does not allow mid-render.
 */
function ContactFields({
  formAction,
  state,
  isPending,
  defaults,
  submitLabel,
  onCancel,
}: {
  formAction: (formData: FormData) => void;
  state: FormState;
  isPending: boolean;
  defaults?: ContactFormValues;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {FIELDS.map((field) => (
        <label
          key={field.name}
          className="flex flex-col gap-1 font-mono text-xs text-muted"
        >
          {field.label}
          <input
            name={field.name}
            type={field.type}
            required={field.required}
            defaultValue={defaults?.[field.name] ?? ""}
            className="rounded border border-line bg-background px-2 py-1.5 font-sans text-sm text-foreground outline-none focus:border-accent"
          />
        </label>
      ))}

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
 * JavaScript Security Hardening). A LinkedIn URL that came back safe still
 * opens with rel="noopener noreferrer", so the new tab can't reach back
 * into this one through window.opener.
 */
function ContactDetails({ contact }: { contact: Contact }) {
  const links = [
    { label: "email", value: contact.email, href: mailtoHref(contact.email) },
    { label: "phone", value: contact.phone, href: telHref(contact.phone) },
    {
      label: "li",
      value: contact.linkedin_url,
      href: profileHref(contact.linkedin_url),
      external: true,
    },
  ].filter((link) => Boolean(link.value));

  return (
    <>
      <p className="text-sm font-medium text-foreground">{contact.name}</p>
      {contact.role && <p className="text-xs text-muted">{contact.role}</p>}
      {links.length > 0 && (
        <dl className="mt-2 flex flex-col gap-0.5">
          {links.map((link) => (
            <div key={link.label} className="flex gap-2 text-xs">
              <dt className="w-10 shrink-0 font-mono text-dim">{link.label}</dt>
              <dd className="min-w-0 break-words">
                {link.href ? (
                  <a
                    href={link.href}
                    className="text-accent2 hover:underline"
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                  >
                    {link.value}
                  </a>
                ) : (
                  <span className="text-muted">{link.value}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  const [isEditing, setIsEditing] = useState(false);
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
          defaults={contactToFormValues(contact)}
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
        </>
      )}
    </li>
  );
}

/**
 * The people at one company: the list, an inline editor per person, and an
 * add form that stays collapsed until you want it, so the pane reads as a
 * contact list rather than a data-entry screen.
 */
export default function ContactList({
  companyId,
  contacts,
}: {
  companyId: string;
  contacts: Contact[];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createContactAction.bind(null, companyId),
    initialState,
  );

  // Closes on success. An earlier version kept the form open and cleared
  // it, on the theory that stakeholders arrive in twos and threes. In
  // practice that left five empty inputs sitting above the actual contact
  // list for the rest of the session, which is the first thing you see
  // when you pick a company. Adding a second person is one more click on
  // "+ add"; reading the list is what this pane is for.
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
        <ul className="mt-3 flex flex-col gap-2">
          {contacts.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </ul>
      )}
    </section>
  );
}
