// Turns a contact's typed-in email, phone or profile URL into an href that
// is safe to render.
//
// AGENTS.md (HTML and JavaScript Security Hardening) forbids binding
// user-controlled data to `href` without checking the scheme against an
// allowlist. Contact fields are exactly that: text the user typed, stored
// in the database, rendered back as clickable links. A value of
// `javascript:alert(1)` in the linkedin_url column would otherwise become
// a working script link on the page.
//
// Every function here returns `null` rather than a broken or unsafe href,
// so the caller renders plain text instead of a link. Failing to a
// non-link is always safe; failing to an unchecked link is not.

const SAFE_URL_SCHEMES = new Set(["https:", "http:"]);

/**
 * An https (or http) URL for a profile link, or null.
 *
 * Accepts a bare `linkedin.com/in/someone` by assuming https, because that
 * is how people paste profile links. Anything that parses to another
 * scheme is rejected: `javascript:`, `data:` and `vbscript:` all fail the
 * SAFE_URL_SCHEMES check, and so does `mailto:` here, which belongs in
 * mailtoHref instead.
 *
 * A value with no scheme has to look like a domain - an `@handle` is not
 * one, and neither is a bare word. That guard exists because `new URL()`
 * is far more willing than you want it to be: `@nico` parses happily as
 * `https://nico/`, so without it, typing a Bluesky handle into the socials
 * box got it silently rewritten into a link to a host called `nico`. Once
 * that value is normalized on the way into the database, the thing you
 * typed is gone. Being unsure is a reason to leave the text alone, not to
 * guess at a URL.
 *
 * An explicit scheme is still taken at its word: if you typed
 * `http://intranet:8080` you meant it.
 */
export function profileHref(value: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);

  if (!hasScheme && trimmed.startsWith("@")) {
    return null;
  }

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (!SAFE_URL_SCHEMES.has(url.protocol)) {
      return null;
    }

    // A dot is the cheapest test for "this is a hostname and not a word".
    // Only applied to the scheme-less case, where we are the ones who
    // decided it was a URL.
    if (!hasScheme && !url.hostname.includes(".")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Which network a profile URL belongs to: "LinkedIn", "GitHub", "X".
 *
 * The list is a display convenience and nothing depends on it being
 * complete. Anything unrecognised falls back to the bare hostname, which
 * is a perfectly good label - "handelsregister.de" says what the link is
 * as well as any word would. That fallback is what makes it safe to stop
 * adding networks here: an unknown one gets labelled, not swallowed.
 *
 * Matched on the hostname's tail rather than with `includes`, so a link to
 * `linkedin.example.com` is not announced as LinkedIn.
 */
const SOCIAL_NAMES: Record<string, string> = {
  "linkedin.com": "LinkedIn",
  "x.com": "X",
  "twitter.com": "X",
  "github.com": "GitHub",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "youtube.com": "YouTube",
  "tiktok.com": "TikTok",
  "threads.net": "Threads",
  "bsky.app": "Bluesky",
  "mastodon.social": "Mastodon",
  "xing.com": "Xing",
};

export function socialLabel(value: string): string {
  const href = profileHref(value);

  if (!href) {
    // Not a URL at all - an @handle, most likely. Shown as typed.
    return value.trim();
  }

  const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
  const parts = host.split(".");

  return (
    SOCIAL_NAMES[host] ??
    SOCIAL_NAMES[parts.slice(-3).join(".")] ??
    SOCIAL_NAMES[parts.slice(-2).join(".")] ??
    host
  );
}

/**
 * A `mailto:` href, or null. The check is deliberately shallow: one `@`
 * with something either side, and no whitespace or control characters that
 * could split the header. Full RFC 5322 validation would reject real
 * addresses, and this value is never used for anything but a link.
 */
export function mailtoHref(value: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(trimmed)) {
    return null;
  }

  return `mailto:${encodeURIComponent(trimmed).replace(/%40/g, "@")}`;
}

/**
 * A `tel:` href, or null. Strips the spaces, brackets and dashes people
 * write phone numbers with, keeping only digits and a leading `+`, since
 * that is all a dialer can use.
 */
export function telHref(value: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const digits = trimmed.replace(/[^\d+]/g, "");
  const normalized = digits.startsWith("+")
    ? `+${digits.slice(1).replace(/\+/g, "")}`
    : digits.replace(/\+/g, "");

  // Shorter than this and it is a typo, not a number worth linking.
  return normalized.replace(/\D/g, "").length >= 6 ? `tel:${normalized}` : null;
}
