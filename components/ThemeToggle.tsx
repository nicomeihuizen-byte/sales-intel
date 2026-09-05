"use client";

import { setThemeAction } from "@/app/actions";
import type { Theme } from "@/lib/theme";

/**
 * Light and dark, from the nav bar.
 *
 * This component holds no state and takes no props, which is the point.
 * The current theme already lives in exactly one place - the `data-theme`
 * attribute the server wrote on <html> - so keeping a React copy of it
 * would be the same value in two places, which is the mistake this project
 * has made three times already in other forms.
 *
 * So the handler reads the attribute, flips it, and tells the server. The
 * label is both words in the markup with CSS hiding one (see globals.css),
 * which means it is right in the first server-rendered paint, right again
 * the moment the attribute changes, and cannot disagree with the page
 * during hydration.
 *
 * The colours change before the action is even sent. Persisting is the
 * slow half and the unimportant half: if it fails, you still get the theme
 * you asked for, and it is dark again next time you load the page.
 */
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next: Theme = root.dataset.theme === "light" ? "dark" : "light";

    root.dataset.theme = next;

    // Deliberately not awaited and deliberately swallowed. The user has
    // their theme; a failed cookie write is worth forgetting the choice,
    // not worth an error message on a screen about sales deals.
    void setThemeAction(next).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between the light and dark theme"
      className="font-mono text-sm text-muted transition-colors hover:text-accent"
    >
      <span className="theme-label-dark">light</span>
      <span className="theme-label-light">dark</span>
    </button>
  );
}
