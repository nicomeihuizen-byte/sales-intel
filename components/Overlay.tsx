"use client";

import { useEffect, type ReactNode } from "react";

/**
 * The dialog shell: a scrim over everything, a raised card in the middle,
 * Escape and the backdrop to close.
 *
 * Extracted from DealBoard when notes and emails needed to pop out too.
 * Writing a second one would have been half an hour's work and the fourth
 * time this project has kept the same thing in two places, which is how a
 * dialog ends up closing on Escape in one corner of the app and not in
 * the other.
 *
 * Focus is deliberately not trapped. These are reading surfaces with the
 * occasional form in them, not modals that have to be answered before the
 * app continues, and a trap on a panel you opened to read something is a
 * cage you then have to find your way out of.
 *
 * An overlay rather than an expanding row, because the desk's three panes
 * must never move. You open a thing, read it, close it, and everything is
 * exactly where you left it.
 *
 * `dismissible` is the exception, and it exists for one specific failure.
 * Adding a company means alt-tabbing to a registry page, copying a VAT
 * number, coming back, pasting, and going again, eight times. Every one of
 * those returns is a click landing somewhere on this screen, and a click on
 * the backdrop unmounts the form and takes twenty minutes of typing with
 * it. So a panel holding a half-filled form sets `dismissible={false}` and
 * can only be left through cancel or save.
 *
 * It stays true by default. A panel you opened to READ costs nothing to
 * close by accident, and a dialog that refuses to go away when you have
 * put nothing into it is the more annoying failure of the two.
 */
export default function Overlay({
  label,
  onClose,
  widthClassName = "max-w-4xl",
  dismissible = true,
  children,
}: {
  /** Announced to screen readers as the dialog's name. */
  label: string;
  onClose: () => void;
  widthClassName?: string;
  /**
   * False while the panel holds unsaved input: the backdrop and Escape
   * both stop closing it, and the form's own cancel button becomes the
   * only way out. Always leave a visible one when passing false.
   */
  dismissible?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!dismissible) {
      return;
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissible, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-center overflow-y-auto bg-scrim p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      // Only a click that lands on the backdrop itself closes it. Without
      // the target check, a click that starts inside the card and drifts
      // out while selecting text closes the thing you were reading.
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`h-fit w-full ${widthClassName} rounded-lg border border-line bg-raised p-6 shadow-[var(--shadow-overlay)]`}
      >
        {children}
      </div>
    </div>
  );
}
