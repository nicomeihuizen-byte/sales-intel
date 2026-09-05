import type { ReactNode } from "react";
import { caseStudyLinkEnabled } from "@/lib/featureFlags";

interface TerminalShellProps {
  children: ReactNode;
  /** Short mono label shown in the terminal bar, e.g. "~/deals". */
  label?: string;
  /** Tailwind max-width class for both the header and the card below it. */
  maxWidthClassName?: string;
  /**
   * Pin the whole terminal window to the height of the viewport instead of
   * letting it grow with its content.
   *
   * For the two list pages, which are lists that grow forever. A page that
   * gets taller every time you add a company means the thing you came to
   * do moves further down the screen the longer you use the app, which is
   * backwards. In this mode the window is exactly one screen and the list
   * inside it scrolls, so the header, the counts and the add form stay
   * where they were the first time you saw them.
   *
   * The child is handed a flex column that has already been told to fill
   * the remaining height, so a list inside it only needs
   * `min-h-0 flex-1 overflow-y-auto` to become the scrolling region.
   * `min-h-0` is the part that is easy to forget and the reason a flex
   * child otherwise refuses to shrink below its content.
   */
  fillViewport?: boolean;
}

/**
 * Wraps every app page in the same terminal-window chrome used on the
 * portfolio site's project pages (traffic-light dots, a raised card on a
 * dark background, a mono status label) so the app doesn't feel like a
 * different product from the case study a visitor arrived from.
 */
export default function TerminalShell({
  children,
  label,
  maxWidthClassName = "max-w-3xl",
  fillViewport = false,
}: TerminalShellProps) {
  return (
    <div className={fillViewport ? "flex h-dvh flex-col" : "min-h-full"}>
      {caseStudyLinkEnabled() && (
        <header className="sticky top-0 z-10 shrink-0 border-b border-line bg-background/90 backdrop-blur">
          <div
            className={`mx-auto flex ${maxWidthClassName} items-center justify-between px-6 py-4`}
          >
            <a
              href="https://www.meihuizen.ai/projects/ai-sales-deal-intelligence.html"
              className="font-mono text-sm text-muted transition-colors hover:text-accent"
            >
              &lt; back to case study
            </a>
          </div>
        </header>
      )}
      <main
        className={
          fillViewport
            ? `mx-auto flex min-h-0 w-full flex-1 flex-col ${maxWidthClassName} px-6 py-6`
            : `mx-auto ${maxWidthClassName} px-6 py-12`
        }
      >
        <div
          className={`overflow-hidden rounded-lg border border-line bg-raised shadow-[var(--shadow-card)] ${
            fillViewport ? "flex min-h-0 flex-1 flex-col" : ""
          }`}
        >
          {/* The Dutch flag as traffic lights. Red and blue are the flag's
              own colours and stay fixed in both themes, because a flag
              that changes shade with the interface is not a flag. The
              white one gets a hairline in every theme: on the dark card it
              is invisible against nothing, but on the light card it is
              white on white, and a border it does not need in one theme
              costs less than the same dot drawn two different ways. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#AE1C28]" />
            <span className="h-2.5 w-2.5 rounded-full border border-line bg-white" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#21468B]" />
            {label && (
              <span className="ml-2 font-mono text-xs text-dim">{label}</span>
            )}
          </div>
          <div
            className={
              fillViewport
                ? "flex min-h-0 flex-1 flex-col p-6 sm:p-8"
                : "p-6 sm:p-8"
            }
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
