"use client";

import { useActionState, useState } from "react";
import {
  draftEmailAction,
  logEmailAction,
  type EmailDraftState,
  type FormState,
} from "@/app/actions";
import { DRAFT_LANGUAGES } from "@/lib/draftLanguages";
import { useActionSuccess } from "@/lib/useActionSuccess";
import type { Contact, Deal } from "@/lib/types";

const initialState: FormState = { error: null };
const initialDraftState: EmailDraftState = {
  error: null,
  draft: null,
  language: "en",
};

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
 * Which deal this email belongs to.
 *
 * Present in both halves of the panel, because both file the same kind of
 * row. Before this, a deal was passed in only when the company had exactly
 * one, and every email at a company with two live deals was filed against
 * the person alone: safe, and useless, since the deal reading is the whole
 * reason to log the email.
 *
 * "no deal" is a real answer, not an empty one. Sending a scan cold, with
 * no deal and no history, is the first move of the motion this app is
 * built around, and that email still has to be on the record.
 */
function DealSelect({
  id,
  deals,
  defaultDealId,
}: {
  id: string;
  deals: Deal[];
  defaultDealId: string | null;
}) {
  if (deals.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="font-mono text-[11px] uppercase text-dim" htmlFor={id}>
        Deal
      </label>
      <select
        id={id}
        name="dealId"
        defaultValue={defaultDealId ?? ""}
        className="min-w-0 flex-1 rounded border border-line bg-background px-2 py-1 font-mono text-xs text-muted outline-none focus:border-accent"
      >
        <option value="" className="text-foreground">
          no deal
        </option>
        {deals.map((deal) => (
          <option key={deal.id} value={deal.id} className="text-foreground">
            {deal.title}
            {deal.status === "open" ? "" : ` (${deal.status})`}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The two buttons that file the email, and the only place the direction
 * is decided.
 *
 * Two submit buttons in one form rather than a radio group and one
 * button: the direction is not a setting you configure before acting, it
 * is the act. It also means the panel needs no client state to remember
 * which way round this email went.
 */
function FileButtons({ disabled }: { disabled: boolean }) {
  return (
    <>
      <button
        type="submit"
        name="direction"
        value="outbound"
        disabled={disabled}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        title="Records this as an email you sent"
      >
        i sent this
      </button>
      <button
        type="submit"
        name="direction"
        value="inbound"
        disabled={disabled}
        className="rounded border border-accent-dim px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:border-accent disabled:opacity-50"
        title="Records this as an email you received"
      >
        i received this
      </button>
    </>
  );
}

/**
 * Paste an email in. The half of this panel that has no AI in it at all.
 *
 * This is the durable thing and it was, until now, only reachable through
 * the convenience built on top of it: the only control that filed an email
 * lived inside a generated draft, so with nothing drafted there was no way
 * to record an email at all. Worth watching for elsewhere - any place
 * where the only route to a record runs through a model call.
 */
function WriteMyself({
  contact,
  deals,
  defaultDealId,
  state,
  formAction,
  isPending,
  onCancel,
}: {
  contact: Contact;
  deals: Deal[];
  defaultDealId: string | null;
  /**
   * The action state is owned by EmailPanel and handed down, the way
   * ContactFields and CompanyFields take theirs.
   *
   * It used to be created here, and this component called `onDone()` -
   * which is EmailPanel's `setIsWriting(false)` - from inside render, via
   * useActionSuccess. React refuses that, and is right to: a component may
   * adjust its OWN state during render, but writing to a different
   * component's state mid-render leaves the two disagreeing about what has
   * already been drawn. Hoisting the state to the component that owns the
   * visibility removes the cross-component write rather than deferring it
   * into an effect, which would only have hidden the same mistake behind
   * an extra render pass.
   */
  state: FormState;
  formAction: (formData: FormData) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <DealSelect
        id={`email-deal-${contact.id}`}
        deals={deals}
        defaultDealId={defaultDealId}
      />

      <label className="sr-only" htmlFor={`email-subject-${contact.id}`}>
        Subject
      </label>
      <input
        id={`email-subject-${contact.id}`}
        name="subject"
        type="text"
        placeholder="Subject"
        className="rounded border border-line bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />

      <label className="sr-only" htmlFor={`email-body-${contact.id}`}>
        Email body
      </label>
      <textarea
        id={`email-body-${contact.id}`}
        name="body"
        required
        rows={6}
        autoFocus
        placeholder={`Paste the email to or from ${contact.name}.`}
        className="rounded border border-line bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
      />

      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}

      {/* On the paste form and not on the draft one. A draft was written
          by the model from notes it was already allowed to read, so there
          is nothing to withhold from it; a pasted email is the case where
          you know as you paste that it should never come back out. */}
      <label className="flex items-center gap-2 font-mono text-[11px] text-dim">
        <input
          type="checkbox"
          name="confidential"
          className="accent-[var(--accent)]"
        />
        keep out of the analysis
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <FileButtons disabled={isPending} />
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-muted hover:text-accent"
        >
          cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Everything to do with one contact's email, in one panel.
 *
 * Called EMAIL rather than DRAFT EMAIL because it does one thing - put an
 * email on the record - and there are two ways in. Neither should own the
 * header, so the buttons carry the distinction instead.
 *
 * Rejected for this header: COPILOT. It names the assistant rather than
 * the job, half the panel has no assistant in it, it is Microsoft's noun
 * now, and it would be a promise about scope that every later AI feature
 * either has to move inside or make into a lie. Held in reserve as a
 * product-level name if there is ever more than Analyze and drafting to
 * collect under it.
 *
 * The drafting half stays copy-only by design. Nothing here sends
 * anything, and subject and body are separate boxes because most mail
 * clients want them pasted into different fields.
 */
export default function EmailPanel({
  contact,
  deals,
  defaultDealId,
  onClose,
}: {
  contact: Contact;
  deals: Deal[];
  defaultDealId: string | null;
  onClose: () => void;
}) {
  const [state, draftAction, isDrafting] = useActionState(
    draftEmailAction.bind(null, contact.id, defaultDealId),
    initialDraftState,
  );
  const [logState, logAction, isLogging] = useActionState(
    logEmailAction.bind(null, contact.id),
    initialState,
  );
  // A second, separate state for the paste form. Same action, different
  // submission: an error filing a pasted email must not blank the draft
  // sitting in the other half of the panel, and vice versa.
  const [pasteState, pasteAction, isPasting] = useActionState(
    logEmailAction.bind(null, contact.id),
    initialState,
  );
  const [isWriting, setIsWriting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Sticky rather than the single render useActionSuccess returns: the
  // confirmation should stay while you are still looking at the draft.
  const [hasLogged, setHasLogged] = useState(false);

  if (useActionSuccess(logState)) {
    setHasLogged(true);
  }

  // Closing the paste form lives here, in the component that owns whether
  // it is open, rather than in the form itself.
  //
  // And it says so afterwards. A form that files the email and then just
  // vanishes leaves you looking at two buttons wondering whether it
  // worked, which on the one screen whose job is "put this on the record"
  // is the wrong thing to be unsure about.
  if (useActionSuccess(pasteState)) {
    setIsWriting(false);
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
          Email
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-xs text-dim hover:text-accent"
        >
          close
        </button>
      </div>

      {/* Both ways in, side by side, and neither is the default. Writing
          one yourself is not the fallback for the AI failing; it is the
          more common of the two, since most email in a pipeline is email
          that already happened. */}
      {!state.draft && !isWriting && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <form action={draftAction} className="flex items-center gap-2">
            <LanguageSelect id={`lang-${contact.id}`} value={state.language} />
            <button
              type="submit"
              disabled={isDrafting}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isDrafting ? "Writing..." : "Write a draft"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setIsWriting(true)}
            className="rounded border border-accent-dim px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:border-accent"
          >
            Add an email
          </button>
        </div>
      )}

      {state.error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {state.error}
        </p>
      )}

      {!isWriting && !state.draft && hasLogged && !pasteState.error && (
        <p className="mt-2 font-mono text-[11px] text-dim">
          Logged against this contact.
        </p>
      )}

      {isWriting && (
        <WriteMyself
          contact={contact}
          deals={deals}
          defaultDealId={defaultDealId}
          state={pasteState}
          formAction={pasteAction}
          isPending={isPasting}
          onCancel={() => setIsWriting(false)}
        />
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

          <div className="flex flex-col gap-3 border-t border-line pt-3">
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

            {/* The same two buttons as the paste form, and the same
                action behind them. A draft is nearly always something you
                then send, but the panel does not get to assume that: you
                can equally have written a draft, thought better of it,
                and be filing the reply that arrived instead. */}
            <form action={logAction} className="flex flex-col gap-2">
              <input
                type="hidden"
                name="subject"
                value={state.draft.subject}
              />
              <input type="hidden" name="body" value={state.draft.body} />
              <DealSelect
                id={`draft-deal-${contact.id}`}
                deals={deals}
                defaultDealId={defaultDealId}
              />
              <div className="flex flex-wrap items-center gap-3">
                <FileButtons disabled={isLogging} />
              </div>
            </form>
          </div>

          {logState.error && (
            <p role="alert" className="text-xs text-danger">
              {logState.error}
            </p>
          )}
          {!logState.error && hasLogged && (
            <p className="font-mono text-[11px] text-dim">
              Logged against this contact.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
