import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getDealById } from "@/lib/deals";
import { listNotesForDeal } from "@/lib/notes";
import NoteForm from "@/components/NoteForm";
import InsightPanel from "@/components/InsightPanel";

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
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/deals" className="text-sm text-zinc-500 underline">
        ← Back to deals
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">{deal.title}</h1>
      <p className="mt-1 text-zinc-500">{deal.company_name}</p>

      <InsightPanel dealId={deal.id} />

      <NoteForm dealId={deal.id} />

      <h2 className="mt-10 text-sm font-medium text-zinc-700">Notes</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {notes.length === 0 && (
          <li className="text-sm text-zinc-500">
            No notes yet. Add the first one above.
          </li>
        )}
        {notes.map((note) => (
          <li
            key={note.id}
            className="rounded border border-zinc-200 px-4 py-3"
          >
            <p className="text-sm text-zinc-800">{note.content}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {new Date(note.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
