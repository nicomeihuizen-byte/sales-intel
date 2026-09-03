import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";
import { listDealsForUser } from "@/lib/deals";
import { signOut } from "@/app/login/actions";
import DealCard from "@/components/DealCard";
import NewDealForm from "@/components/NewDealForm";
import TerminalShell from "@/components/TerminalShell";

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const deals = await listDealsForUser(supabase);

  return (
    <TerminalShell label="~/deals">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-accent">
          Deals
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/companies"
            className="font-mono text-sm text-muted hover:text-accent"
          >
            companies
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-sm text-muted hover:text-accent"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
      <p className="mt-2 text-muted">Signed in as {user?.email}.</p>

      <NewDealForm />

      <ul className="mt-8 flex flex-col gap-3">
        {deals.length === 0 && (
          <li className="text-sm text-muted">
            No deals yet. Add your first one above.
          </li>
        )}
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard deal={deal} />
          </li>
        ))}
      </ul>
    </TerminalShell>
  );
}
