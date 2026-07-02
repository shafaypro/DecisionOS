"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";
import { Text } from "@/components/ui/text";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl/Cmd", "K"], label: "Open command palette" },
  { keys: ["?"], label: "Show this cheatsheet" },
  { keys: ["C"], label: "Create a new decision" },
  { keys: ["G", "D"], label: "Go to Decisions" },
  { keys: ["G", "R"], label: "Go to Reviews" },
  { keys: ["G", "A"], label: "Go to Analytics" },
  { keys: ["G", "T"], label: "Go to Team" },
  { keys: ["G", "S"], label: "Go to Settings" },
  { keys: ["Esc"], label: "Close overlays and modals" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function ShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let lastG = 0;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      if (e.key === "Escape" && open) {
        setOpen(false);
        return;
      }

      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        router.push("/decisions/new");
        return;
      }

      const now = Date.now();
      if (e.key.toLowerCase() === "g") {
        lastG = now;
        return;
      }

      if (lastG && now - lastG < 1200) {
        lastG = 0;
        const key = e.key.toLowerCase();
        if (key === "a") {
          e.preventDefault();
          router.push("/analytics");
          return;
        }
        if (key === "d") {
          e.preventDefault();
          router.push("/decisions");
          return;
        }
        if (key === "r") {
          e.preventDefault();
          router.push("/reviews");
          return;
        }
        if (key === "t") {
          e.preventDefault();
          router.push("/team");
          return;
        }
        if (key === "s") {
          e.preventDefault();
          router.push("/settings");
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xs bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-blue-500" />
            <Text size="sm" weight="semibold" color="secondary">
              Keyboard shortcuts
            </Text>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xs p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between px-5 py-2.5">
              <Text size="sm" color="secondary">{s.label}</Text>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <Text
                    as="kbd"
                    key={`${s.label}-${i}`}
                    size="2xs"
                    color="muted"
                    mono
                  >
                    {k}
                  </Text>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Text as="p" size="sm" color="subtle">
          Shortcuts are disabled while you are typing in a field.
        </Text>
      </div>
    </div>
  );
}
