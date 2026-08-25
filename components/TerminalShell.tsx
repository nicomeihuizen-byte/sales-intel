import type { ReactNode } from "react";

interface TerminalShellProps {
  children: ReactNode;
  /** Short mono label shown in the terminal bar, e.g. "~/deals". */
  label?: string;
  /** Tailwind max-width class for both the header and the card below it. */
  maxWidthClassName?: string;
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
}: TerminalShellProps) {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
        <div className={`mx-auto flex ${maxWidthClassName} items-center justify-between px-6 py-4`}>
          <a
            href="https://www.meihuizen.ai/projects/ai-sales-deal-intelligence.html"
            className="font-mono text-sm text-muted transition-colors hover:text-accent"
          >
            &lt; back to case study
          </a>
        </div>
      </header>
      <main className={`mx-auto ${maxWidthClassName} px-6 py-12`}>
        <div className="overflow-hidden rounded-lg border border-line bg-raised shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#AE1C28]" />
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#21468B]" />
            {label && (
              <span className="ml-2 font-mono text-xs text-dim">{label}</span>
            )}
          </div>
          <div className="p-6 sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
