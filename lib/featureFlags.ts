/**
 * Whether this deployment may delete deals and companies.
 *
 * Off unless `ALLOW_DESTRUCTIVE_ACTIONS` is set to "true". The default
 * direction is deliberate: the hosted demo is a public page with a
 * one-click login, so anyone who wanders in from the case study can press
 * any button on it. A delete button there is a stranger emptying the demo.
 *
 * Failing closed means a forgotten config leaves the demo safe and the
 * local app missing a button, which is a visible, harmless problem. The
 * other direction fails silently and publicly.
 *
 * Not a NEXT_PUBLIC_ variable, and checked in the server actions rather
 * than only where the buttons render. A flag the browser can read is a
 * flag the browser can lie about: hiding a button hides nothing, since a
 * server action is an HTTP endpoint that exists whether or not anything on
 * the page points at it. The UI reads this to decide what to draw; the
 * actions read it to decide what to allow, and that second check is the
 * one that matters.
 *
 * Server-only by convention, the same way lib/ai.ts is: imported from
 * Server Components and server actions, never from a "use client" file.
 * The `server-only` package would turn that into a build error, but it is
 * a dependency this project does not otherwise need, and the rule has one
 * enforcement point that matters anyway - the check inside each action.
 */
export function destructiveActionsEnabled(): boolean {
  // Trimmed and lower-cased so TRUE, True and a stray trailing space all
  // work. That loosening costs nothing in safety, since only a deliberate
  // "true" enables anything either way, and it removes an hour of
  // wondering why the buttons never appeared.
  return process.env.ALLOW_DESTRUCTIVE_ACTIONS?.trim().toLowerCase() === "true";
}

/**
 * Whether to show the "back to case study" link in the header.
 *
 * That link exists for the public demo: someone arrives from the portfolio
 * page, tries the app, and needs a way back. On the local copy it is a
 * link out of the tool you are working in, to a page about the tool you
 * are working in.
 *
 * Default is ON, the opposite of destructiveActionsEnabled, and for the
 * same reason: the deployment that must keep working should need no
 * configuration. Hosted is untouched; local sets
 * SHOW_CASE_STUDY_LINK=false and forgetting to do so costs a stray link,
 * not a broken demo.
 */
export function caseStudyLinkEnabled(): boolean {
  return process.env.SHOW_CASE_STUDY_LINK?.trim().toLowerCase() !== "false";
}
