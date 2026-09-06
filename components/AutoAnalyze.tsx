"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshStaleDealsAction } from "@/app/actions";

/**
 * Brings the traffic light up to date when the deals page opens, without
 * anybody pressing anything.
 *
 * The work happens **after** the page has painted, and that is the whole
 * design. Doing it during the render would mean a Server Component holding
 * its HTML until every model call returned, which on a book of twenty deals
 * is over a minute of blank screen. The list arrives instantly from the
 * stored readings, this fires, and the colours change under you a moment
 * later.
 *
 * It only ever runs for deals that are actually stale. The server counted
 * them and passed the number; `refreshStaleDealsAction` works that out
 * again for itself, because a count arriving from the browser is a number
 * the browser could have made up.
 *
 * It is deliberately not silent. Each run spends money, and an app that
 * quietly bills you while you look at a list is one you stop trusting. The
 * line says how many deals and then says how many were done.
 */

/**
 * Set when a run fails, and never cleared.
 *
 * Module scope rather than component state, so it survives navigating away
 * from `/deals` and back. Without it a failing analysis would be retried on
 * every visit for the rest of the session: the deals stay stale, so the
 * condition that triggered the run is still true, and each retry costs
 * another call. A hard reload clears it, which is the right way to ask for
 * another attempt because it is deliberate.
 */
let refreshFailedThisPageLoad = false;

type RunState = "idle" | "running" | "done" | "failed";

export default function AutoAnalyze({ staleCount }: { staleCount: number }) {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [runState, setRunState] = useState<RunState>("idle");
  const [analyzed, setAnalyzed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasStarted.current || refreshFailedThisPageLoad || staleCount === 0) {
      return;
    }

    hasStarted.current = true;
    setRunState("running");

    // Guards the two state writes that would otherwise land after this
    // component has gone, which is easy to reach here: the run takes
    // seconds and the page it belongs to is one click from being left.
    let isMounted = true;

    refreshStaleDealsAction()
      .then((result) => {
        if (!isMounted) {
          return;
        }

        if (result.error) {
          refreshFailedThisPageLoad = true;
          setRunState("failed");
          setMessage(result.error);
          return;
        }

        setAnalyzed(result.analyzed);
        setRunState("done");

        // Only when something was written. router.refresh() re-fetches the
        // whole route, and doing that to render identical rows is a round
        // trip spent on nothing.
        if (result.analyzed > 0) {
          router.refresh();
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        refreshFailedThisPageLoad = true;
        setRunState("failed");
        setMessage("The automatic analysis could not run.");
      });

    return () => {
      isMounted = false;
    };
  }, [router, staleCount]);

  if (runState === "idle") {
    return null;
  }

  if (runState === "failed") {
    return (
      <p role="alert" className="font-mono text-xs text-danger">
        {message}
      </p>
    );
  }

  if (runState === "running") {
    return (
      <p role="status" className="font-mono text-xs text-dim">
        analysing {staleCount} deal{staleCount === 1 ? "" : "s"}...
      </p>
    );
  }

  // A run that found nothing to do says nothing. "0 analysed" is a report
  // on the absence of work, which is not news.
  if (analyzed === 0) {
    return null;
  }

  return (
    <p role="status" className="font-mono text-xs text-dim">
      {analyzed} deal{analyzed === 1 ? "" : "s"} re-analysed
    </p>
  );
}
