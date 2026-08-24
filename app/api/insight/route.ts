import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getDealById } from "@/lib/deals";
import { listNotesForDeal } from "@/lib/notes";
import { analyzeDealMomentum } from "@/lib/ai";

interface AnalyzeDealBody {
  dealId: string;
}

function isAnalyzeDealBody(value: unknown): value is AnalyzeDealBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { dealId?: unknown }).dealId === "string"
  );
}

// Stalled-deal AI insight. This is the only route that imports lib/ai.ts,
// which is in turn the only module that reads ANTHROPIC_API_KEY - the key
// never reaches a client component or the browser (see AGENTS.md - API &
// Secrets Handling). Not persisted: each click re-runs the analysis against
// the current note history, which is intentional for this phase - there is
// no stored "last insight" column on deals yet.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);

  if (!isAnalyzeDealBody(body)) {
    return NextResponse.json(
      { error: "dealId is a required string." },
      { status: 400 },
    );
  }

  let deal;

  try {
    deal = await getDealById(supabase, body.dealId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load deal." },
      { status: 500 },
    );
  }

  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }

  try {
    const notes = await listNotesForDeal(supabase, deal.id);
    const insight = await analyzeDealMomentum(deal.title, notes);
    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to analyze deal.",
      },
      { status: 500 },
    );
  }
}
