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

// Raised from 512 when the three tools started returning an action list
// alongside the reasoning string, then to 1536 while chasing the IronGate
// failure. A truncated tool_use block is unparseable, so the ceiling sits
// well above the realistic worst case (a long reasoning plus five action
// items) rather than trimmed to it. requestStructuredToolCall reports a
// max_tokens stop_reason as its own distinct failure, so if this is ever
// too low the error says so instead of looking like a bad response.
const MAX_RESPONSE_TOKENS = 1536;

// The action list every one of the three tools returns, under a different
// property name each time (nextSteps / recommendedActions /
// repeatablePlays). The prompts ask for two to four items.
//
// The ceiling is a trim, not a rejection: a model that returns six good
// items on a 50-note deal has not made an error worth failing the whole
// analysis over, so normalizeActionList keeps the first five. Same for a
// blank entry, which is dropped rather than failing its siblings. Only an
// empty result is a real failure, because there is then nothing to show.
const MAX_ACTION_ITEMS = 5;

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

/**
 * The outcome of checking one AI tool_use payload. Carries the repaired
 * value on success and a short, human-readable `problem` on failure. The
 * problem string is written to be safe to surface to the client: it names
 * the offending property and what was wrong with it, never any note
 * content, prompt text or key material (see AGENTS.md - API & Secrets
 * Handling). Without it, a rejection was indistinguishable from any
 * other, which made a real failure on a real deal undiagnosable.
 */
type ValidationOutcome<T> =
  | { valid: true; value: T }
  | { valid: false; problem: string };

/**
 * Repairs and returns the action list at `property`, or null if there is
 * nothing usable there. Trims every entry, drops the blank ones, and caps
 * the result at MAX_ACTION_ITEMS. Returns null in exactly two cases: the
 * property is not an array at all, or every entry in it was blank.
 *
 * The repair is deliberate. A response with six items or one stray empty
 * string is a formatting slip, not a wrong answer, and failing the whole
 * analysis over it costs the user a real result they would have been
 * happy with.
 */
function normalizeActionList(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, MAX_ACTION_ITEMS);

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Shared field checks for all three tools: every one returns a non-blank
 * `reasoning` plus an action list under its own property name. Returns
 * the repaired pair, or a problem string naming which of the two failed
 * and how.
 */
function validateSharedFields(
  candidate: { reasoning?: unknown },
  listProperty: string,
  listValue: unknown,
): ValidationOutcome<{ reasoning: string; actions: string[] }> {
  if (typeof candidate.reasoning !== "string") {
    return {
      valid: false,
      problem: `"reasoning" was ${describeType(candidate.reasoning)}, expected a string`,
    };
  }

  const reasoning = candidate.reasoning.trim();

  if (reasoning.length === 0) {
    return { valid: false, problem: `"reasoning" was an empty string` };
  }

  const actions = normalizeActionList(listValue);

  if (!actions) {
    return {
      valid: false,
      problem: `"${listProperty}" was ${describeType(listValue)}, expected an array of at least one non-empty string`,
    };
  }

  return { valid: true, value: { reasoning, actions } };
}

/**
 * A short, safe description of what came back in a field, for the problem
 * strings above. Reports shape only, never contents, so nothing from the
 * note history can leak into an error message that reaches the browser.
 */
function describeType(value: unknown): string {
  if (value === undefined) {
    return "missing";
  }

  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "an empty array" : `an array of ${value.length}`;
  }

  return `a ${typeof value}`;
}

function validateDealInsight(value: unknown): ValidationOutcome<DealInsight> {
  if (typeof value !== "object" || value === null) {
    return { valid: false, problem: `the tool input was ${describeType(value)}` };
  }

  const candidate = value as {
    status?: unknown;
    reasoning?: unknown;
    nextSteps?: unknown;
  };

  if (
    typeof candidate.status !== "string" ||
    !VALID_MOMENTUM_STATUSES.includes(candidate.status as DealMomentum)
  ) {
    return {
      valid: false,
      problem: `"status" was not one of ${VALID_MOMENTUM_STATUSES.join(", ")}`,
    };
  }

  const shared = validateSharedFields(candidate, "nextSteps", candidate.nextSteps);

  if (!shared.valid) {
    return shared;
  }

  return {
    valid: true,
    value: {
      status: candidate.status as DealMomentum,
      reasoning: shared.value.reasoning,
      nextSteps: shared.value.actions,
    },
  };
}

function validateDealLossReview(
  value: unknown,
): ValidationOutcome<DealLossReview> {
  if (typeof value !== "object" || value === null) {
    return { valid: false, problem: `the tool input was ${describeType(value)}` };
  }

  const candidate = value as {
    verdict?: unknown;
    reasoning?: unknown;
    recommendedActions?: unknown;
  };

  if (
    typeof candidate.verdict !== "string" ||
    !VALID_LOSS_VERDICTS.includes(candidate.verdict as LossReviewVerdict)
  ) {
    return {
      valid: false,
      problem: `"verdict" was not one of ${VALID_LOSS_VERDICTS.join(", ")}`,
    };
  }

  const shared = validateSharedFields(
    candidate,
    "recommendedActions",
    candidate.recommendedActions,
  );

  if (!shared.valid) {
    return shared;
  }

  return {
    valid: true,
    value: {
      verdict: candidate.verdict as LossReviewVerdict,
      reasoning: shared.value.reasoning,
      recommendedActions: shared.value.actions,
    },
  };
}

function validateDealWinReview(
  value: unknown,
): ValidationOutcome<DealWinReview> {
  if (typeof value !== "object" || value === null) {
    return { valid: false, problem: `the tool input was ${describeType(value)}` };
  }

  const candidate = value as {
    pattern?: unknown;
    reasoning?: unknown;
    repeatablePlays?: unknown;
  };

  if (
    typeof candidate.pattern !== "string" ||
    !VALID_WIN_PATTERNS.includes(candidate.pattern as WinPattern)
  ) {
    return {
      valid: false,
      problem: `"pattern" was not one of ${VALID_WIN_PATTERNS.join(", ")}`,
    };
  }

  const shared = validateSharedFields(
    candidate,
    "repeatablePlays",
    candidate.repeatablePlays,
  );

  if (!shared.valid) {
    return shared;
  }

  return {
    valid: true,
    value: {
      pattern: candidate.pattern as WinPattern,
      reasoning: shared.value.reasoning,
      repeatablePlays: shared.value.actions,
    },
  };
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

// Appended to all three prompts. The em dash ban mirrors AGENTS.md
// (Text Formatting for Generated Prose): the model's output is prose this
// project ships, so it follows the same rule the rest of the copy does.
const PROSE_STYLE_RULES = `Write in plain English, the way a rep would say it out loud. Never use an em dash or an en dash as a pause; use a comma, a semicolon or a second sentence instead.`;

/**
 * The shared instruction block for an action list. `listLabel` names the
 * property the tool expects (nextSteps, recommendedActions,
 * repeatablePlays) and `itemBrief` says what one item should contain, so
 * each prompt gets the same rules about specificity and length without
 * repeating them three times.
 */
function buildActionListInstruction(
  listLabel: string,
  itemBrief: string,
): string {
  return `Also return ${listLabel}: two to four items, most important first. ${itemBrief}

Every item must be an instruction someone could act on this week, grounded in something the notes actually say: name the person, the objection, the document or the date involved. One short sentence each, at most about 15 words, no trailing period needed. Reject your own first draft of an item if it would read the same on any other deal, for example "follow up with the customer", "maintain regular communication" or "keep the relationship warm".

${listLabel} is required and must never be empty. There is always something to do, even when the honest read is bleak: closing the deal out cleanly, recording why it went the way it did, or making one last attempt on a named person all count as actions. If you find yourself with nothing to put here, that is a sign to write the uncomfortable recommendation, not to return an empty list.`;
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
- at_risk: long silence, explicit pushback, or no plausible next step left in the current approach

Call ${MOMENTUM_TOOL_NAME} with your classification and a short reasoning (one to three sentences) that cites specifics from the note history above, such as dates or what was actually said. Do not write a generic summary of the notes.

${buildActionListInstruction(
  "nextSteps",
  "These are the concrete moves that would get this deal moving again, or keep it moving if it is healthy. Match them to the classification you chose: a healthy deal needs the next step that protects the close, a stalling deal needs the specific unblocking action, an at-risk deal needs either a real recovery attempt or an honest call on whether to disqualify it. Classifying a deal at_risk never means there is nothing to do: it means the current approach has run out, so the actions are the change of approach, or the clean close-out.",
)}

${PROSE_STYLE_RULES}`;
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

Call ${LOSS_REVIEW_TOOL_NAME} with your verdict and a short reasoning (one to three sentences) that cites specifics from the notes. If you classify as worth_revisiting, name the specific avenue that was not explored rather than writing a generic "keep in touch" recommendation.

${buildActionListInstruction(
  "recommendedActions",
  "What these items contain depends on your verdict. For worth_revisiting, they are the steps of an actual re-approach: who to contact, what to lead with, and roughly when, tied to the trigger that would make the timing right. For confirmed_lost, they are what to do differently in the next deal that looks like this one, pointing at the moment in this history where it went wrong.",
)}

${PROSE_STYLE_RULES}`;
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

Call ${WIN_REVIEW_TOOL_NAME} with your classification and a short reasoning (one to three sentences) that names specific, repeatable factors visible in the notes, such as dates or what was actually said.

${buildActionListInstruction(
  "repeatablePlays",
  "These are the plays from this deal a rep should deliberately run again in the next one. Write each as an instruction for a future deal, not as an observation about this one: \"open the security review before the pilot ends\" rather than \"the security review started early\".",
)}

${PROSE_STYLE_RULES}`;
}

/**
 * The JSON-schema fragment for one of the three action lists. `minItems`
 * is 1 rather than the 2 the prompt asks for, because one genuinely
 * important action is a legitimate answer and the schema should not
 * forbid it. `maxItems` mirrors MAX_ACTION_ITEMS so the model is told the
 * same ceiling normalizeActionList enforces.
 *
 * Schema bounds are a hint to the model, not a guarantee, which is why
 * normalizeActionList still trims and re-checks the array afterwards.
 */
function buildActionListSchema(description: string): Record<string, unknown> {
  return {
    type: "array",
    minItems: 1,
    maxItems: MAX_ACTION_ITEMS,
    items: {
      type: "string",
      description:
        "One specific, actionable instruction of about 15 words or fewer.",
    },
    description,
  };
}

interface StructuredToolCallOptions<T> {
  toolName: string;
  toolDescription: string;
  inputSchema: Anthropic.Tool.InputSchema;
  validate: (value: unknown) => ValidationOutcome<T>;
}

/**
 * Shared request/validate/retry logic for all three AI calls below.
 * Requests the response as a tool call with a fixed input schema instead
 * of parsing free text, then validates the result against that schema
 * (see AGENTS.md - Code Review / Explanation Standards, on not trusting
 * external API output without validation).
 *
 * The retry carries the rejection back to the model rather than resending
 * the same prompt blind. The first attempt sends the prompt alone; if the
 * result is rejected, the second attempt replays the model's own tool_use
 * block and answers it with an is_error tool_result naming what was
 * wrong. Resending an identical prompt only helps when the failure was
 * random, and a model that misreads an instruction will misread it the
 * same way twice, which is how a deterministic failure turned into "did
 * not match the expected shape on attempt 2 of 2" with nothing to act on.
 *
 * Three distinguishable failures reach the caller, each naming its cause:
 * the response was cut off at the token limit (raise
 * MAX_RESPONSE_TOKENS), no tool_use block came back at all (a model or
 * API-level problem), or the payload failed validation (the `problem`
 * string from the validator names the offending property). None of the
 * three includes note content or prompt text, so the message is safe for
 * the route to pass to the client.
 */
async function requestStructuredToolCall<T>(
  client: Anthropic,
  prompt: string,
  options: StructuredToolCallOptions<T>,
): Promise<T> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];
  let lastProblem = "no attempt was made";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_RESPONSE_TOKENS,
      messages,
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

    if (!toolUse) {
      lastProblem =
        response.stop_reason === "max_tokens"
          ? `the response was cut off at the ${MAX_RESPONSE_TOKENS} token limit before the tool call finished`
          : `no ${options.toolName} tool call came back (stop_reason: ${response.stop_reason ?? "unknown"})`;
      break;
    }

    const outcome = options.validate(toolUse.input);

    if (outcome.valid) {
      return outcome.value;
    }

    lastProblem =
      response.stop_reason === "max_tokens"
        ? `the response was cut off at the ${MAX_RESPONSE_TOKENS} token limit, leaving an incomplete tool call`
        : outcome.problem;

    if (attempt < MAX_ATTEMPTS) {
      messages.push(
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUse.id,
              is_error: true,
              content: `Rejected: ${lastProblem}. Call ${options.toolName} again with the same analysis, fixing only that field. Every field is required and no array may be empty.`,
            },
          ],
        },
      );
    }
  }

  throw new Error(
    `The AI's ${options.toolName} response was unusable after ${MAX_ATTEMPTS} attempts: ${lastProblem}.`,
  );
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
 * classification, a specific cited reasoning string, and a nextSteps list
 * of two to four concrete actions for this deal. Only meaningful for a
 * deal still in play - see reviewLostDeal for the closed-deal equivalent.
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
        nextSteps: buildActionListSchema(
          "Two to four concrete next actions for this deal, most important first, each grounded in the note history.",
        ),
      },
      required: ["status", "reasoning", "nextSteps"],
    },
    validate: validateDealInsight,
  });
}

/**
 * Reviews a lost deal's note history and decides whether the loss looks
 * final, or whether there is a specific unaddressed angle worth revisiting
 * later. This is a different question from momentum (which assumes the
 * deal is still open), so it gets its own prompt, tool, and result type
 * (DealLossReview) rather than overloading DealInsight's status values.
 *
 * The recommendedActions list is verdict-dependent by design: on
 * worth_revisiting it is a re-approach plan, on confirmed_lost it is what
 * to change in the next deal of this shape. Both branches always return a
 * list, so a confirmed loss still leaves the rep with something to use.
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
        recommendedActions: buildActionListSchema(
          "Two to four actions: the steps of a re-approach if worth_revisiting, or what to do differently in the next similar deal if confirmed_lost.",
        ),
      },
      required: ["verdict", "reasoning", "recommendedActions"],
    },
    validate: validateDealLossReview,
  });
}

/**
 * Reviews a won deal's note history for what made it work: the pace of
 * momentum and the specific, repeatable factors visible in the notes.
 * Momentum classification (healthy/stalling/at_risk) doesn't apply to a
 * deal that already closed, so this gets its own prompt, tool, and result
 * type (DealWinReview) rather than reusing DealInsight.
 *
 * The repeatablePlays list is the part meant to travel: each item is
 * phrased as an instruction for a future deal, so it stays useful once
 * this deal is closed and archived.
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
        repeatablePlays: buildActionListSchema(
          "Two to four plays from this deal, each written as an instruction to run again in a future deal rather than as an observation about this one.",
        ),
      },
      required: ["pattern", "reasoning", "repeatablePlays"],
    },
    validate: validateDealWinReview,
  });
}
