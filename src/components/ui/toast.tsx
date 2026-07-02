"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { Text } from "@/components/ui/text";

/**
 * Minimal zero-dep toast system.
 *
 * Wrap the app once in <ToastProvider/>. Anywhere in a client component,
 * `const toast = useToast(); toast.success("Saved")` queues a dismissable
 * toast that auto-hides after 4s.
 *
 * We keep this intentionally small - if we need grouped toasts, action
 * buttons, or promise-toasts later, swap in sonner.
 */

export type ToastKind = "success" | "error" | "info";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  show: (kind: ToastKind, message: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Render-without-provider fallback: log to console so code paths don't crash
    // during SSR or tests. Callers still work, they just don't animate.
    return {
      show: (k, m) => console.log(`[toast:${k}]`, m),
      success: (m) => console.log("[toast:success]", m),
      error: (m) => console.log("[toast:error]", m),
      info: (m) => console.log("[toast:info]", m),
    };
  }
  return ctx;
}

let NEXT_ID = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>((kind, message) => {
    const id = NEXT_ID++;
    setToasts((t) => [...t, { id, kind, message }]);
    // Auto-dismiss after 4s.
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const api: ToastContextValue = {
    show,
    success: (m) => show("success", m),
    error: (m) => show("error", m),
    info: (m) => show("info", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Defer to next frame so the enter transition plays.
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const tone =
    toast.kind === "success"
      ? "border-emerald-200 bg-emerald-50"
      : toast.kind === "error"
      ? "border-rose-200 bg-rose-50"
      : "border-slate-200 bg-white";
  const Icon =
    toast.kind === "success" ? CheckCircle2 : toast.kind === "error" ? AlertCircle : Info;
  const iconTone =
    toast.kind === "success"
      ? "text-emerald-600"
      : toast.kind === "error"
      ? "text-rose-600"
      : "text-blue-600";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-2 rounded-xs border px-4 py-3 shadow-soft transition-all duration-200 ${tone} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${iconTone}`} />
      <Text
        as="p"
        size="sm"
        color={toast.kind === "success" ? "success" : toast.kind === "error" ? "danger" : "primary"}
      >
        {toast.message}
      </Text>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-2 rounded-xs p-0.5 text-slate-400 hover:bg-black/5 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
