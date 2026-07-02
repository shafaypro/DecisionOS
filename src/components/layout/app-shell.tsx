"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

interface AppShellProps {
  workspaceName: string;
  userName: string;
  userEmail: string;
  reviewsDue: number;
  isPlatformAdmin?: boolean;
  children: React.ReactNode;
}

/**
 * Responsive application shell. On desktop the sidebar is a static column; on
 * < lg it collapses into an off-canvas drawer toggled by a floating button.
 */
export function AppShell({
  workspaceName,
  userName,
  userEmail,
  reviewsDue,
  isPlatformAdmin,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar - static on desktop, off-canvas drawer on mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-soft" : "-translate-x-full",
        )}
      >
        <Sidebar
          workspaceName={workspaceName}
          userName={userName}
          userEmail={userEmail}
          reviewsDue={reviewsDue}
          isPlatformAdmin={isPlatformAdmin}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      {/* Scrim behind the drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile drawer toggle - floats over content since the top bar is gone */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-30 flex h-9 w-9 items-center justify-center rounded-xs bg-white text-text-muted shadow-soft transition-colors hover:bg-slate-100 hover:text-text-primary lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <main className="relative flex-1 overflow-y-auto bg-slate-50">
          <div className="relative min-h-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
