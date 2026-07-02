"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

const KEY = "decisionos-cookie-notice";

/**
 * One-time, dismissible cookie notice. DecisionOS only uses a strictly-necessary
 * encrypted session cookie (no trackers), so this is disclosure, not consent
 * gating. Remembered in localStorage so it shows once per browser.
 */
export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Sync visibility from localStorage (a client-only external system) once
    // after mount. Reading it during render would break SSR/hydration.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      // localStorage unavailable (private mode): just don't show.
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
        <Text as="p" size="sm" color="secondary">
          We use one essential cookie to keep you signed in. No tracking or ads. See our{" "}
          <Text as={Link} href="/privacy" size="sm" color="brand">Privacy Policy</Text>.
        </Text>
        <Button size="sm" onClick={dismiss}>Got it</Button>
      </div>
    </div>
  );
}
