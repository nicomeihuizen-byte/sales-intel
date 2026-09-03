import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createDeal, listDealsForUser } from "@/lib/deals";

interface CreateDealBody {
  companyName: string;
  title: string;
}

function isCreateDealBody(value: unknown): value is CreateDealBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { companyName?: unknown }).companyName === "string" &&
    typeof (value as { title?: unknown }).title === "string"
  );
}

// CRUD for deals. GET lists the signed-in user's deals (see lib/deals.ts);
// POST creates one, finding or creating the parent company by name. Row
// Level Security on the `deals`/`companies` tables (supabase/migrations) is
// the real access boundary - the auth.getUser() check below just turns a
// missing session into a clear 401 instead of an empty RLS-filtered result.
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const deals = await listDealsForUser(supabase);
    return NextResponse.json({ deals });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load deals.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);

  if (!isCreateDealBody(body)) {
    return NextResponse.json(
      { error: "companyName and title are required strings." },
      { status: 400 },
    );
  }

  try {
    const deal = await createDeal(supabase, user.id, body);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create deal.",
      },
      { status: 400 },
    );
  }
}
