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
 */
export function profileHref(value: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
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
