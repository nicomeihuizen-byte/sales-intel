import TerminalShell from "@/components/TerminalShell";

/**
 * Shown the instant a navigation starts, until the page's data arrives.
 *
 * Without this, clicking a prospect did nothing visible: a Server Component
 * sends no HTML until every query it awaits has finished, so the browser
 * kept showing the previous page, fully interactive and completely wrong,
 * for as long as the round trips took. It read as a broken click rather
 * than a slow one, which is worse, because a broken click gets clicked
 * again.
 *
 * Deliberately generic. This file is the loading boundary for the whole
 * root segment, so it appears for the desk, the companies list and the
 * deals list alike, and a skeleton shaped like one of them would be wrong
 * on the other two.
 */
export default function Loading() {
  return (
    <TerminalShell label="~/" maxWidthClassName="max-w-[1800px]">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-accent2">{"// loading"}</span>
        {/* Three dots on staggered delays. Motion is the whole job here:
            something must be visibly happening or the click looks lost. */}
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
        </span>
      </div>

      {/* A rough impression of the pipeline strip and the three panes.
          Enough that the layout does not jump when the real thing lands. */}
      <div className="mt-6 h-24 animate-pulse rounded border border-line bg-raised" />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,14rem)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="h-64 animate-pulse rounded border border-line bg-raised" />
        <div className="h-64 animate-pulse rounded border border-line bg-raised" />
        <div className="h-64 animate-pulse rounded border border-line bg-raised" />
      </div>

      <span className="sr-only">Loading</span>
    </TerminalShell>
  );
}
