import type { Theme } from "./theme";

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

/**
 * Whether opening the deals page may re-analyse the deals that need it.
 *
 * Off unless `AUTO_ANALYSIS` is set to "true", and the default direction is
 * the same one `destructiveActionsEnabled` uses, for a sharper version of
 * the same reason. A refresh is one paid model call per deal. The hosted
 * demo is a public page with a one-click login, so a flag that defaulted on
 * would mean every stranger arriving from the case study spends the API
 * budget, silently, as fast as they can click.
 *
 * Failing closed means a forgotten config leaves a deployment without
 * automatic colours, which is visible and free. The other direction fails
 * invisibly and on an invoice.
 *
 * Checked in the server action as well as where the trigger renders. Not
 * rendering the trigger hides nothing: a server action is an HTTP endpoint
 * whether or not anything on the page points at it, and that second check
 * is the one that matters.
 *
 * Server-only, like the two above. Never import this from a "use client"
 * file: see components/LoginForm.tsx for what that costs.
 */
export function autoAnalysisEnabled(): boolean {
  return process.env.AUTO_ANALYSIS?.trim().toLowerCase() === "true";
}

/**
 * Which theme a visitor with no cookie yet gets.
 *
 * Light unless `DEFAULT_THEME` says "dark", which is the same direction as
 * caseStudyLinkEnabled and for the same reason: the hosted demo is the
 * deployment that has to be right without anyone remembering to configure
 * it, and light is what it opens in now, so that the demo and the case
 * study page it is linked from are not the same picture twice.
 *
 * The local copy sets DEFAULT_THEME=dark. Forgetting to costs one glance
 * at a light screen and one line in .env.local. The other direction fails
 * the way bad defaults always do: the hosted demo would keep opening dark,
 * nothing would look broken, and the change would silently not have
 * happened on the only deployment anyone else sees.
 *
 * Only a default. Once the visitor touches the toggle, the cookie decides
 * and this is never consulted again.
 */
export function defaultTheme(): Theme {
  return process.env.DEFAULT_THEME?.trim().toLowerCase() === "dark"
    ? "dark"
    : "light";
}
