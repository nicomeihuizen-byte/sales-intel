import { createServerSupabaseClient } from "@/lib/supabase";
import { signOut } from "@/app/login/actions";

export default async function DealsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      <p className="mt-2 text-zinc-500">
        Signed in as {user?.email}. Deal list coming soon. This page is part
        of the initial scaffold.
      </p>
    </div>
  );
}
