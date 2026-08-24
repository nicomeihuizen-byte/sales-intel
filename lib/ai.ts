import Anthropic from "@anthropic-ai/sdk";
import type {
  DealInsight,
  DealLossReview,
  DealMomentum,
  DealWinReview,
  LossReviewVerdict,
  Note,
  WinPattern,
} from "./types";

// The only module allowed to read ANTHROPIC_API_KEY (see AGENTS.md - API &
// Secrets Handling). Only ever imported from app/api/insight/route.ts, a
// server-only route handler - never from a "use client" component.

// claude-sonnet-5 as of 2026-08-24 (see docs.claude.com/models for the
// current list) - a good balance of reasoning quality and cost for a
// once-per-click "analyze this deal" action, not a chat feature that needs
// the fastest possible response.
const MODEL = "claude-sonnet-5";
const MAX_ATTEMPTS = 2;

const MOMENTUM_TOOL_NAME = "report_deal_momentum";
const VALID_MOMENTUM_STATUSES: DealMomentum[] = [
  "healthy",
  "stalling",
  "at_risk",
];

const LOSS_REVIEW_TOOL_NAME = "report_loss_review";
const VALID_LOSS_VERDICTS: LossReviewVerdict[] = [
  "confirmed_lost",
  "worth_revisiting",
];

const WIN_REVIEW_TOOL_NAME = "report_win_review";
const VALID_WIN_PATTERNS: WinPattern[] = [
  "fast_and_clean",
  "steady_and_thorough",
  "recovered_momentum",
];

function isDealInsight(value: unknown): value is DealInsight {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { status?: unknown; reasoning?: unknown };

  return (
    typeof candidate.status === "string" &&
    VALID_MOMENTUM_STATUSES.includes(candidate.status as DealMomentum) &&
    typeof candidate.reasoning === "string" &&
    candidate.reasoning.trim().length > 0
  );
}

function isDealLossReview(value: unknown): value is DealLossReview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { verdict?: unknown; reasoning?: unknown };

  return (
    typeof candidate.verdict === "string" &&
    VALID_LOSS_VERDICTS.includes(candidate.verdict as LossReviewVerdict) &&
    typeof candidate.reasoning === "string" &&
    candidate.reasoning.trim().length > 0
  );
}

function isDealWinReview(value: unknown): value is DealWinReview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { pattern?: unknown; reasoning?: unknown };

  return (
    typeof candidate.pattern === "string" &&
    VALID_WIN_PATTERNS.includes(candidate.pattern as WinPattern) &&
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

function buildMomentumPrompt(
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

Call ${MOMENTUM_TOOL_NAME} with your classification and a short reasoning (one to three sentences) that cites specifics from the note history above, such as dates or what was actually said. Do not write a generic summary of the notes.`;
}

function buildLossReviewPrompt(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date,
): string {
  const today = now.toISOString().slice(0, 10);

  return `You are doing a loss post-mortem on a sales deal called "${dealTitle}" that was marked lost. Today's date is ${today}.

Note history, oldest first:
${formatNoteHistory(notes)}

Decide whether this loss looks final, or whether there is a specific unaddressed objection, an unexplored stakeholder, a timing factor such as a budget cycle resetting, or a competitive angle that suggests this deal could realistically be worth revisiting later.

Classify as exactly one of:
- confirmed_lost: the reason for losing is clear and there is no realistic path to revisit, for example they explicitly chose a competitor and seem satisfied, or the underlying need went away
- worth_revisiting: there is a specific gap, such as an objection that was never fully addressed, a stakeholder who was never reached, or a timing factor that could change, suggesting a future check-in could be worthwhile

Call ${LOSS_REVIEW_TOOL_NAME} with your verdict and a short reasoning (one to three sentences) that cites specifics from the notes. If you classify as worth_revisiting, name the specific avenue that was not explored rather than writing a generic "keep in touch" recommendation.`;
}

function buildWinReviewPrompt(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date,
): string {
  const today = now.toISOString().slice(0, 10);

  return `You are doing a win analysis on a sales deal called "${dealTitle}" that was marked won. Today's date is ${today}.

Note history, oldest first:
${formatNoteHistory(notes)}

Identify what worked: the pace of momentum from first contact to close, and the specific factors that stood out, such as how objections were handled, stakeholder engagement, timing, or what triggered forward movement at key moments. Focus on what a rep could deliberately repeat in a future deal, not a summary or a congratulations.

Classify the overall pattern as exactly one of:
- fast_and_clean: a short cycle with minimal friction and clear buyer alignment throughout
- steady_and_thorough: a longer cycle that progressed with consistent forward motion and no major stalls
- recovered_momentum: the deal had a real stall, gap, or setback partway through but still closed

Call ${WIN_REVIEW_TOOL_NAME} with your classification and a short reasoning (one to three sentences) that names specific, repeatable factors visible in the notes, such as dates or what was actually said.`;
}

interface StructuredToolCallOptions<T> {
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool.InputSchema;
  validate: (value: unknown) => value is T;
}

/**
 * Shared request/validate/retry logic for both AI calls below. Requests
 * the response as a tool call with a fixed input schema instead of parsing
 * free text, then validates the result against that schema (see AGENTS.md
 * - Code Review / Explanation Standards, on not trusting external API
 * output without validation). Retries once on a malformed response before
 * giving up.
 */
async function requestStructuredToolCall<T>(
  client: Anthropic,
  prompt: string,
  options: StructuredToolCallOptions<T>,
): Promise<T> {
  let lastError = new Error(
    `Failed to get a valid "${options.toolName}" response from the AI.`,
  );

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: options.toolName,
          description: options.toolDescription,
          input_schema: options.inputSchema,
        },
      ],
      tool_choice: { type: "tool", name: options.toolName },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (toolUse && options.validate(toolUse.input)) {
      return toolUse.input;
    }

    lastError = new Error(
      `AI response did not match the expected shape on attempt ${attempt} of ${MAX_ATTEMPTS} (tool: ${options.toolName}).`,
    );
  }

  throw lastError;
}

function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  return apiKey;
}

/**
 * Analyzes an open deal's note history and returns a momentum
 * classification plus a specific, cited reasoning string. Only meaningful
 * for a deal still in play - see reviewLostDeal for the closed-deal
 * equivalent.
 */
export async function analyzeDealMomentum(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date = new Date(),
): Promise<DealInsight> {
  const client = new Anthropic({ apiKey: requireApiKey() });
  const prompt = buildMomentumPrompt(dealTitle, notes, now);

  return requestStructuredToolCall(client, prompt, {
    toolName: MOMENTUM_TOOL_NAME,
    toolDescription:
      "Report the momentum classification and reasoning for a sales deal.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: VALID_MOMENTUM_STATUSES,
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
    validate: isDealInsight,
  });
}

/**
 * Reviews a lost deal's note history and decides whether the loss looks
 * final, or whether there is a specific unaddressed angle worth revisiting
 * later. This is a different question from momentum (which assumes the
 * deal is still open), so it gets its own prompt, tool, and result type
 * (DealLossReview) rather than overloading DealInsight's status values.
 */
export async function reviewLostDeal(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date = new Date(),
): Promise<DealLossReview> {
  const client = new Anthropic({ apiKey: requireApiKey() });
  const prompt = buildLossReviewPrompt(dealTitle, notes, now);

  return requestStructuredToolCall(client, prompt, {
    toolName: LOSS_REVIEW_TOOL_NAME,
    toolDescription:
      "Report whether a lost deal's loss looks final or worth revisiting, with reasoning.",
    inputSchema: {
      type: "object",
      properties: {
        verdict: {
          type: "string",
          enum: VALID_LOSS_VERDICTS,
          description: "Whether the loss looks final or worth revisiting.",
        },
        reasoning: {
          type: "string",
          description:
            "A short, specific, plain-English explanation that cites the notes. If worth_revisiting, names the specific unexplored avenue.",
        },
      },
      required: ["verdict", "reasoning"],
    },
    validate: isDealLossReview,
  });
}

/**
 * Reviews a won deal's note history for what made it work: the pace of
 * momentum and the specific, repeatable factors visible in the notes.
 * Momentum classification (healthy/stalling/at_risk) doesn't apply to a
 * deal that already closed, so this gets its own prompt, tool, and result
 * type (DealWinReview) rather than reusing DealInsight.
 */
export async function reviewWonDeal(
  dealTitle: string,
  notes: NoteForAnalysis[],
  now: Date = new Date(),
): Promise<DealWinReview> {
  const client = new Anthropic({ apiKey: requireApiKey() });
  const prompt = buildWinReviewPrompt(dealTitle, notes, now);

  return requestStructuredToolCall(client, prompt, {
    toolName: WIN_REVIEW_TOOL_NAME,
    toolDescription:
      "Report the win pattern and reasoning for a sales deal that closed won.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          enum: VALID_WIN_PATTERNS,
          description: "The overall shape of how the deal closed.",
        },
        reasoning: {
          type: "string",
          description:
            "A short, specific, plain-English explanation that names repeatable factors visible in the notes.",
        },
      },
      required: ["pattern", "reasoning"],
    },
    validate: isDealWinReview,
  });
}
