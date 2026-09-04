/**
 * The languages an email draft can be written in.
 *
 * This lives in its own module rather than in lib/ai.ts because the
 * language picker is a client component, and lib/ai.ts is the one file
 * allowed to read ANTHROPIC_API_KEY. Importing it from anything with
 * "use client" at the top would pull that module into the browser bundle,
 * which is the exact thing AGENTS.md forbids. A plain list of language
 * codes has no such problem.
 *
 * A closed set rather than a free string, because the value is
 * interpolated into a prompt: an arbitrary string from the browser
 * reaching a prompt is a prompt anyone can rewrite.
 */
export const DRAFT_LANGUAGES = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
} as const;

export type DraftLanguage = keyof typeof DRAFT_LANGUAGES;

export function isDraftLanguage(value: unknown): value is DraftLanguage {
  return typeof value === "string" && value in DRAFT_LANGUAGES;
}
