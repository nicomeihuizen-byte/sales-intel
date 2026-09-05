import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listDealsForUser } from "@/lib/deals";
import type { DealStatus } from "@/lib/types";
import AppNav from "@/components/AppNav";
import NewDealForm from "@/components/NewDealForm";
import TerminalShell from "@/components/TerminalShell";

// Every deal, across every company. The reference list, in the same shape
// as the companies page: one screen tall, the list scrolling inside it.

const STATUS_LABEL: Record<DealStatus, string> = {
  open: "open",
  won: "won",
  lost: "lost",
};

const STATUS_STYLE: Record<DealStatus, string> = {
  open: "text-accent2",
  won: "text-ok",
  lost: "text-dim",
};

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient();
  const deals = await listDealsForUser(supabase);

  const open = deals.filter((deal) => deal.status === "open");
  // Unpriced deals are left out rather than counted as zero, the same way
  // the pipeline strip treats them: nobody has put a number on them yet,
  // which is not the same as them being worth nothing.
  const openValue = open.reduce((total, deal) => total + (deal.value_eur ?? 0), 0);

  return (
    <TerminalShell
      label="~/deals"
      maxWidthClassName="max-w-[1800px]"
      fillViewport
    >
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-accent">
            Deals
          </h1>
          <p className="mt-1 text-sm text-muted">
            {deals.length} total · {open.length} open · {EURO.format(openValue)}{" "}
            in the open pipeline
          </p>
        </div>
        <AppNav current="deals" />
      </div>

      <div className="scroll-pane mt-5 min-h-0 flex-1 overflow-y-auto rounded border border-line">
        {deals.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No deals yet. Add your first one below.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-background/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {deal.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-dim">
                      {deal.company_name}
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm text-muted">
                      {deal.value_eur === null ? "–" : EURO.format(deal.value_eur)}
                    </span>
                    <span
                      className={`mt-0.5 block font-mono text-xs uppercase ${STATUS_STYLE[deal.status]}`}
                    >
                      {STATUS_LABEL[deal.status]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0">
        <NewDealForm />
      </div>
    </TerminalShell>
  );
}
