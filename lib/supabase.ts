import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

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
            // where cookies() is read-only. Safe to ignore because
            // createMiddlewareSupabaseClient below refreshes the session on
            // every request - see the @supabase/ssr docs on this pattern.
          }
        },
      },
    },
  );
}

/**
 * Client for middleware.ts. Middleware runs before next/headers' cookies()
 * is available, so this reads and writes cookies directly on the
 * request/response pair instead. Used to refresh the session on every
 * request and to redirect unauthenticated visitors away from protected
 * routes (see middleware.ts).
 */
export function createMiddlewareSupabaseClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );
}
