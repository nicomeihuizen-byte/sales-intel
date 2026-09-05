/**
 * The two themes, and the cookie that remembers which one you chose.
 *
 * Deliberately free of any Next.js import, so both a Server Component
 * reading the cookie and the "use client" toggle writing it can share the
 * same names. The moment this file imports `next/headers` it stops being
 * importable from the browser, and the cookie name ends up written out
 * twice - which is the failure this project has made three times already
 * (see the DEAL_COLUMNS and COMPANY_COLUMNS exports).
 */
export type Theme = "dark" | "light";

export const THEME_COOKIE = "five-theme";

/**
 * A year. The choice is a preference, not a session: someone who picks
 * light once should not be handed dark again next Monday.
 */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Narrows an unknown cookie value to a theme.
 *
 * This is a gate, not a convenience. The value it guards is stamped
 * straight into an attribute on <html>, so anything that is not one of
 * these two words has to fall out here rather than reach the markup.
 */
export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}
