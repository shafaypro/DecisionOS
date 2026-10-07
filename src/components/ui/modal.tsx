"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Text } from "@/components/ui/text";

/**
 * Centered modal dialog: dimmed overlay, Esc / backdrop click to close, body
 * scroll locked while open. Rendered via portal so it escapes any overflow or
 * stacking context of the trigger's position in the tree.
 *
 * Accessibility: the visible title names the dialog via aria-labelledby, focus
 * moves into the dialog on open, Tab cycles inside it, and focus is restored to
 * the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Callers usually pass an inline arrow, which is a new function every render.
  // Reading it through a ref keeps the effect below keyed on `open` alone -
  // otherwise each keystroke in the dialog re-ran it and yanked focus away.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // Only a press that both starts and ends on the backdrop closes the dialog, so
  // drag-selecting text inside it and releasing outside doesn't discard input.
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Move focus into the dialog, remembering where it came from so we can
    // restore it when the dialog closes (WAI-ARIA dialog pattern).
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in"
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressStartedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xs bg-white p-6 shadow-soft space-y-4 outline-none"
      >
        <div className="flex items-center justify-between">
          <Text as="h2" id={titleId}>{title}</Text>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text-subtle transition-colors hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
