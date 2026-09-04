"use client";

import { useEffect, useState } from "react";
import DealStatusPicker from "@/components/DealStatusPicker";
import DealValueField from "@/components/DealValueField";
import NoteList from "@/components/NoteList";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { deleteDealAction } from "@/app/actions";
import type { Deal, DealInsightRecord, DealMomentum, Note } from "@/lib/types";

// The stored momentum verdicts, in the same colour families the analysis
// panel uses, so a summary in this pane and the badge inside the overlay
// read as the same statement rather than two.
const MOMENTUM_STYLE: Record<DealMomentum, string> = {
  healthy: "text-emerald-400",
  stalling: "text-amber-400",
  at_risk: "text-red-400",
};

const MOMENTUM_LABEL: Record<DealMomentum, string> = {
  healthy: "healthy",
  stalling: "stalling",
  at_risk: "at risk",
};

/**
 * The full-screen view of one deal: its analysis, its notes, and the form
 * to add another.
 *
 * An overlay rather than an expanding row, so the three panes never move.
 * That is the difference between a control centre and a page that
 * reflows every time you look at something: you can open a deal, read it,
 * close it, and everything is exactly where you left it.
 *
 * Escape closes it, the backdrop closes it, and focus is not trapped:
 * this is a reading surface with a couple of forms in it, not a modal
 * that must be answered before the app continues.
 */
function DealOverlay({
  deal,
  notes,
  canDelete,
  onClose,
}: {
  deal: Deal & { company_name?: string };
  notes: Note[];
  canDelete: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${deal.title} detail`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="h-fit w-full max-w-4xl rounded-lg border border-line bg-raised p-6 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {deal.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <DealStatusPicker dealId={deal.id} status={deal.status} />
              <DealValueField dealId={deal.id} valueEur={deal.value_eur} />
              {canDelete && (
                <ConfirmDeleteButton
                  action={deleteDealAction}
                  hiddenFields={{ dealId: deal.id }}
                  confirmLabel="remove + notes?"
                />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 font-mono text-sm text-dim transition-colors hover:text-accent"
          >
            close
          </button>
        </div>

        <InsightPanel dealId={deal.id} dealStatus={deal.status} />

        <NoteForm dealId={deal.id} />

        <NoteList notes={notes} />
      </div>
    </div>
  );
}

/**
 * The deals pane: every deal for the selected company, each showing the
 * last thing the analysis said about it, and the overlay that opens when
 * you click one.
 *
 * The summaries are the stored verdicts, not live calls. Rendering this
 * pane never talks to the model; only the analysis inside the overlay and
 * the pipeline strip's refresh do that.
 */
export default function DealBoard({
  deals,
  insightsByDeal,
  notesByDeal,
  canDelete,
}: {
  deals: Deal[];
  insightsByDeal: Record<string, DealInsightRecord>;
  notesByDeal: Record<string, Note[]>;
  canDelete: boolean;
}) {
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  const openDeal = deals.find((deal) => deal.id === openDealId) ?? null;

  return (
    <>
      <ul className="mt-3 flex flex-col gap-2">
        {deals.map((deal) => {
          const insight = insightsByDeal[deal.id];

          return (
            <li key={deal.id}>
              <button
                type="button"
                onClick={() => setOpenDealId(deal.id)}
                className="w-full rounded border border-line px-3 py-2.5 text-left transition-colors hover:border-accent-dim"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {deal.title}
                  </span>
                  {insight && (
                    <span
                      className={`shrink-0 font-mono text-[11px] uppercase ${MOMENTUM_STYLE[insight.momentum]}`}
                    >
                      {MOMENTUM_LABEL[insight.momentum]}
                    </span>
                  )}
                </div>

                {/* Three lines of the stored reasoning. Enough to know
                    whether this is the deal you were looking for, not
                    enough to read instead of opening it. */}
                <p className="mt-1 line-clamp-3 text-xs text-muted">
                  {insight
                    ? insight.reasoning
                    : "Not analysed yet. Open it and press Analyze."}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {openDeal && (
        <DealOverlay
          deal={openDeal}
          notes={notesByDeal[openDeal.id] ?? []}
          canDelete={canDelete}
          onClose={() => setOpenDealId(null)}
        />
      )}
    </>
  );
}
