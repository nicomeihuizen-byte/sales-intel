import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createNote, listNotesForDeal } from "@/lib/notes";

interface CreateNoteBody {
  dealId: string;
  content: string;
}

function isCreateNoteBody(value: unknown): value is CreateNoteBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { dealId?: unknown }).dealId === "string" &&
    typeof (value as { content?: unknown }).content === "string"
  );
}

// CRUD for notes, scoped to a single deal via the `dealId` query param
// (GET) or request body (POST). See lib/notes.ts for the underlying
// queries; RLS on the `notes` table (supabase/migrations) is the real
// access boundary.
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const dealId = new URL(request.url).searchParams.get("dealId");

  if (!dealId) {
    return NextResponse.json(
      { error: "dealId query parameter is required." },
      { status: 400 },
    );
  }

  try {
    const notes = await listNotesForDeal(supabase, dealId);
    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load notes.",
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

  if (!isCreateNoteBody(body)) {
    return NextResponse.json(
      { error: "dealId and content are required strings." },
      { status: 400 },
    );
  }

  try {
    const note = await createNote(supabase, user.id, body);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create note.",
      },
      { status: 400 },
    );
  }
}
