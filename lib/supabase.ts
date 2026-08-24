import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// This is the single place the Supabase client is constructed (see
// AGENTS.md). Every other module imports one of the two functions below
// instead of calling createBrowserClient/createServerClient directly.

/**
 * Client for "use client" components. Uses the anon key, which is safe to
 * expose to the browser - Row Level Security on every table is what
 * actually restricts access, not this key being secret.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Client for server components, route handlers, and server actions. Reads
 * the user's session from cookies via @supabase/ssr so RLS policies see the
 * signed-in user (auth.uid()), instead of an anonymous request.
 *
 * Still uses the anon key, not the service-role key - this respects RLS
 * rather than bypassing it. A service-role client (for admin-only work that
 * must bypass RLS) does not exist yet; add it separately and explicitly if
 * a real need for one shows up, never as the default server client.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll is called from a Server Component in some code paths,
            // where cookies() is read-only. Safe to ignore as long as
            // middleware is refreshing the session (added in the auth
            // phase) - see the @supabase/ssr docs on this exact pattern.
          }
        },
      },
    },
  );
}
