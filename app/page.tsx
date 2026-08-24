import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";

// The root route has no content of its own - it just sends visitors to the
// right place depending on whether they're already signed in, instead of
// showing the default create-next-app starter page.
export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/deals" : "/login");
}
