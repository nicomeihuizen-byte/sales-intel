import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase";

// Public one-click entry point for the "Live demo" link on the portfolio
// site. Signs the visitor in as the demo account without the password ever
// reaching the browser: SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD are
// server-only env vars (the same pair scripts/seed.ts uses locally), read
// here and never returned in the response. Safe to expose publicly, since
// the demo account only ever holds seeded, fake data - see scripts/seed.ts.
//
// Needs SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD set as Production
// environment variables in Vercel, not just in .env.local - this route
// runs on the deployed server, not on a developer's machine.
export async function GET() {
  const email = process.env.SEED_DEMO_EMAIL;
  const password = process.env.SEED_DEMO_PASSWORD;

  if (!email || !password) {
    redirect("/login");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login");
  }

  redirect("/deals");
}
