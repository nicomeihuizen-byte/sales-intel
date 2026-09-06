import LoginForm from "@/components/LoginForm";
import TerminalShell from "@/components/TerminalShell";

/**
 * The login page.
 *
 * A Server Component, deliberately, and the reason is worth keeping: this
 * file used to start with `"use client"` and render `TerminalShell`
 * itself, which shipped the shell to the browser. The shell reads
 * `SHOW_CASE_STUDY_LINK` through `caseStudyLinkEnabled()`, that variable
 * exists only on the server, and so the two renders disagreed about
 * whether to draw the header. Hydration failed on local, where the
 * variable is set to false, and passed on hosted, where it is unset and
 * both sides guessed the same default.
 *
 * The interactive half now lives in components/LoginForm.tsx. Everything
 * a page needs from the client belongs in a leaf, not at the top: put
 * `"use client"` on the page and every component it renders goes with it,
 * including the ones that read server-only configuration.
 */
export default function LoginPage() {
  return (
    <TerminalShell label="~/login" maxWidthClassName="max-w-sm">
      <LoginForm />
    </TerminalShell>
  );
}
