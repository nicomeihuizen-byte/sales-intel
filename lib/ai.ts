import Anthropic from "@anthropic-ai/sdk";
import type { DealInsight, DealMomentum, Note } from "./types";

// The only module allowed to read ANTHROPIC_API_KEY (see AGENTS.md - API &
// Secrets Handling). Only ever imported from app/api/insight/route.ts, a
// server-only route handler - never from a "use client" component.

// claude-sonnet-5 as of 2026-08-24 (see docs.claude.com/models for the
// current list) - a good balance of reasoning quality and cost for a
// once-per-click "analyze this deal" action, not a chat feature that needs
// the fastest possible response.
const MODEL = "claude-sonnet-5";
const MAX_ATTEMPTS = 2;
const REPORT_TOOL_NAME = "report_deal_momentum";
const VALID_STATUSES: DealMomentum[] = ["healthy", "stalling", "at_risk"];

function isDealInsight(value: unknown): value is DealInsight {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { status?: unknown; reasoning?: unknown };

  return (
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status as DealMomentum) &&
    typeof candidate.reasoning === "string" &&
    candidate.reasoning.trim().length > 0
  );
}

type NoteForAnalysis = Pick<Note, "content" | "created_at">;

function formatNoteHistory(notes: NoteForAnalysis[]): string {
  if (notes.length === 0) {
    return "No notes have been logged for this deal yet.";
  }

  return notes
    .map((note) => {
      const date = new Date(note.created_at).toISOString().slice(0, 10);
      return `[${date}] ${note.content}`;
    })
    .join("\n");
}

function daysBetween(earlierIso: string, laterDate: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const elapsed = laterDate.getTime() - new Date(earlierIso).getTime();
  return Math.max(0, Math.floor(elapsed / millisecondsPerDay));
}

function buildPrompt(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date,
): string {
  const today = now.toISOString().slice(0, 10);
  const lastNote = notes.at(-1);
  const lastNoteAgeLine = lastNote
    ? `The most recent note is ${daysBetween(lastNote.created_at, now)} day(s) old.`
    : "There is no note history yet.";

  return `You are reviewing the note history for a sales deal called "${dealTitle}". Today's date is ${today}. ${lastNoteAgeLine}

Note history, oldest first:
${formatNoteHistory(notes)}

Reason about momentum, not just content. Consider three things: the gap in days between notes (a widening gap signals stalling even when each individual note reads fine), whether recent notes describe forward movement (a next step, a scheduled meeting, a commitment from the prospect) or stagnation (waiting on a reply, no response, a pushback with no plan to address it), and how the current pace compares to the deal's own pace earlier in its history.

Classify the deal as exactly one of:
- healthy: recent notes show forward movement and a reasonable contact cadence
- stalling: the cadence has slowed or recent notes show hesitation with no clear next step, but the deal is not dead
- at_risk: long silence, explicit pushback, or no plausible next step remains

Call ${REPORT_TOOL_NAME} with your classification and a short reasoning (one to three sentences) that cites specifics from the note history above, such as dates or what was actually said. Do not write a generic summary of the notes.`;
}

/**
 * Analyzes a deal's note history and returns a momentum classification plus
 * a specific, cited reasoning string. Requests the response as a tool call
 * with a fixed input schema instead of parsing free text, then validates
 * the result against that schema (see AGENTS.md - Code Review /
 * Explanation Standards, on not trusting external API output without
 * validation). Retries once on a malformed response before giving up.
 */
export async function analyzeDealMomentum(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date = new Date(),
): Promise<DealInsight> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(dealTitle, notes, now);

  let lastError = new Error("Failed to get a valid deal insight from the AI.");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: REPORT_TOOL_NAME,
          description:
            "Report the momentum classification and reasoning for a sales deal.",
          input_schema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: VALID_STATUSES,
                description: "The deal's momentum classification.",
              },
              reasoning: {
                type: "string",
                description:
                  "A short, specific, plain-English explanation that cites the notes.",
              },
            },
            required: ["status", "reasoning"],
          },
        },
      ],
      tool_choice: { type: "tool", name: REPORT_TOOL_NAME },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUse && isDealInsight(toolUse.input)) {
      return toolUse.input;
    }

    lastError = new Error(
      `AI response did not match the expected shape on attempt ${attempt} of ${MAX_ATTEMPTS}.`,
    );
  }

  throw lastError;
}
