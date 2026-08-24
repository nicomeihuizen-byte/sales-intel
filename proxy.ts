import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase";

// Refreshes the Supabase session cookie on every request (access tokens
// expire and need rotating - without this, a page could render with a
// stale/expired token) and enforces the two auth rules for this app:
// unauthenticated visitors are redirected away from /deals, and already
// signed-in visitors are redirected away from /login.
//
// Named `proxy` rather than `middleware` - Next.js 16 renamed the file
// convention (same behavior, see node_modules/next/dist/docs). This is an
// optimistic, UX-level redirect only; Row Level Security in
// supabase/schema.sql is the actual access-control boundary underneath it.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createMiddlewareSupabaseClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = request.nextUrl.pathname.startsWith("/deals");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && isProtectedRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const dealsUrl = request.nextUrl.clone();
    dealsUrl.pathname = "/deals";
    const redirectResponse = NextResponse.redirect(dealsUrl);
    // Carry over any refreshed session cookie so the redirect doesn't
    // accidentally drop a token rotation that just happened above.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Run on every route except static assets and image optimization files -
  // those never need a session check and skipping them keeps middleware
  // fast.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
