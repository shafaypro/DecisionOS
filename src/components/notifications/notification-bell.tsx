"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Inbox, X, Check } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils";
import { Text } from "@/components/ui/text";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  assigned:       "📋",
  mentioned:      "💬",
  review_due:     "⏰",
  status_changed: "🔄",
  action_done:    "✅",
};

export function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [panelPos, setPanelPos]     = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setPanelPos({ top: rect.top - 8, left: rect.left });
  }, []);

  function fetchNotifications() {
    setLoading(true);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .finally(() => setLoading(false));
  }

  // Poll every 30 s for new notifications
  useEffect(() => {
    const initialFetch = setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 30_000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function markAllRead() {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }

  function markRead(id: string) {
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    });
  }

  const panel =
    open && panelPos
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-80 -translate-y-full overflow-hidden rounded-xs bg-white shadow-soft"
            style={{ top: panelPos.top, left: panelPos.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <Text size="sm" weight="semibold" color="primary">Notifications</Text>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-text-brand hover:text-text-brand-soft"
                  >
                    <Check className="h-3 w-3" />
                    <Text as="span" size="xs" color="inherit">Mark all read</Text>
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <Text as="div" size="sm" color="subtle">
                  Loading…
                </Text>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Inbox className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <Text size="sm" color="subtle">All caught up!</Text>
                </div>
              ) : (
                notifications.map((n) => {
                  const content = (
                    <div
                      className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${!n.isRead ? "bg-blue-50/50" : ""}`}
                      onClick={() => !n.isRead && markRead(n.id)}
                    >
                      <Text as="span" size="lg">
                        {TYPE_ICONS[n.type] ?? "🔔"}
                      </Text>
                      <div className="flex-1 min-w-0">
                        <Text
                          as="p"
                          size="sm"
                          color={!n.isRead ? "primary" : "secondary"}
                          weight={!n.isRead ? "semibold" : undefined}
                        >
                          {n.title}
                        </Text>
                        {n.body && (
                          <Text as="p" size="xs" color="muted" truncate>
                            {n.body}
                          </Text>
                        )}
                        <Text as="p" size="xs" color="subtle">
                          {formatRelativeDate(n.createdAt)}
                        </Text>
                      </div>
                      {!n.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );

                  return n.linkUrl ? (
                    <Link key={n.id} href={n.linkUrl} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  ) : (
                    <div key={n.id}>{content}</div>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open) {
            fetchNotifications();
            updatePanelPosition();
            setOpen(true);
          } else {
            setOpen(false);
          }
        }}
        className="group flex w-full items-center gap-3 rounded-xs px-4 py-3 transition-colors hover:bg-[#f4f5f9]"
        aria-label="Notifications"
      >
        <Inbox className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <Text as="span" size="sm" color="secondary">
          Inbox
        </Text>
        {unreadCount > 0 && (
          <Text as="span" size="2xs" weight="bold" color="inverse" leading="none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        )}
      </button>
      {panel}
    </>
  );
}
