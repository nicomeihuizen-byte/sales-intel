import { createServerSupabaseClient } from "@/lib/supabase";
import { listDealsForUser } from "@/lib/deals";
import { signOut } from "@/app/login/actions";
import DealCard from "@/components/DealCard";
import NewDealForm from "@/components/NewDealForm";

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const deals = await listDealsForUser(supabase);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deals</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-zinc-500 underline">
            Log out
          </button>
        </form>
      </div>
      <p className="mt-2 text-zinc-500">Signed in as {user?.email}.</p>

      <NewDealForm />

      <ul className="mt-8 flex flex-col gap-3">
        {deals.length === 0 && (
          <li className="text-sm text-zinc-500">
            No deals yet. Add your first one above.
          </li>
        )}
        {deals.map((deal) => (
          <li key={deal.id}>
            <DealCard deal={deal} />
          </li>
        ))}
      </ul>
    </div>
  );
}
