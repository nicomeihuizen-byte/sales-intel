import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getDealById } from "@/lib/deals";
import { listNotesForDeal } from "@/lib/notes";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";
import NoteList from "@/components/NoteList";
import DealStatusPicker from "@/components/DealStatusPicker";
import TerminalShell from "@/components/TerminalShell";

interface DealDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DealDetailPage({
  params,
}: DealDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const deal = await getDealById(supabase, id);

  if (!deal) {
    notFound();
  }

  const notes = await listNotesForDeal(supabase, deal.id);

  return (
    <TerminalShell label={`~/deals/${deal.id.slice(0, 8)}`}>
      <Link
        href="/deals"
        className="font-mono text-sm text-muted hover:text-accent"
      >
        &lt; back to deals
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-accent">
            {deal.title}
          </h1>
          <p className="mt-1 text-muted">{deal.company_name}</p>
        </div>
        <DealStatusPicker dealId={deal.id} status={deal.status} />
      </div>

      <InsightPanel dealId={deal.id} dealStatus={deal.status} />

      <NoteForm dealId={deal.id} />

      <h2 className="mt-10 font-mono text-sm text-accent2">{"// notes"}</h2>
      <NoteList notes={notes} />
    </TerminalShell>
  );
}
