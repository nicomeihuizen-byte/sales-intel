import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getDealById } from "@/lib/deals";
import { listNotesForAnalysis } from "@/lib/notes";
import { analyzeDealMomentum, reviewLostDeal, reviewWonDeal } from "@/lib/ai";
import { forgetDealInsight, recordDealInsight } from "@/lib/insights";

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
// Secrets Handling). Nothing is persisted: every click re-runs the
// analysis against the current note history.
//
// The question asked depends on the deal's own status: an open deal gets
// a momentum read (analyzeDealMomentum), a lost deal gets a loss
// post-mortem instead (reviewLostDeal), and a won deal gets a win
// analysis (reviewWonDeal) - asking "is this deal stalling" about a deal
// that's already closed doesn't make sense either way, see
// components/InsightPanel.tsx.
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
    // listNotesForAnalysis, never listNotesForDeal: confidential notes
    // are excluded here and in the three other prompt paths, and that
    // exclusion lives in one function on purpose.
    const notes = await listNotesForAnalysis(supabase, deal.id);

    // A closed deal drops whatever momentum reading it had. Leaving a
    // stale "healthy" behind would keep it feeding the pipeline health
    // meter, which only counts open deals but would have no way to know
    // the stored row no longer describes anything live.
    if (deal.status === "lost") {
      const review = await reviewLostDeal(deal.title, notes);
      await forgetDealInsight(supabase, deal.id).catch(() => {});
      return NextResponse.json({ mode: "loss_review", review });
    }

    if (deal.status === "won") {
      const review = await reviewWonDeal(deal.title, notes);
      await forgetDealInsight(supabase, deal.id).catch(() => {});
      return NextResponse.json({ mode: "win_review", review });
    }

    const insight = await analyzeDealMomentum(deal.title, notes);

    // Storing the result is what keeps the health meter current without
    // any extra AI calls: looking at a deal updates the dashboard. A
    // failure here is swallowed on purpose - the user asked for an
    // analysis and got one, and losing the cached copy is not worth
    // turning that into an error.
    await recordDealInsight(
      supabase,
      user.id,
      deal.id,
      insight.status,
      insight.reasoning,
    ).catch(() => {});

    return NextResponse.json({ mode: "momentum", insight });
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
