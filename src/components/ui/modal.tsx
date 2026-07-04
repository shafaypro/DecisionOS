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
 * moves into the dialog on open and is restored to the trigger on close.
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
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
