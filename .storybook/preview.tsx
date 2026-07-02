import type { Preview, Decorator } from "@storybook/nextjs";
import React from "react";
import { ToastProvider } from "../src/components/ui/toast";
import "../src/app/globals.css";

/**
 * URL-aware fetch stub. The network-driven components (notification-bell,
 * command-palette, inline-review-buttons) call /api/* routes that don't exist in
 * Storybook. We return sensible empty payloads so they render their loaded
 * state without a backend. A story can override any response shape via
 * `parameters.mockData["/api/..."]`.
 */
const DEFAULT_RESPONSES: Record<string, unknown> = {
  "/api/notifications": { notifications: [], unreadCount: 0 },
  "/api/decisions/similar": { matches: [] },
  "/api/decisions/search": { decisions: [] },
  "/api/decisions/reviews": { ok: true },
  "/api/decisions/ai-draft": {
    chosenOption: "Adopt the proposed approach",
    rationale: "Sample AI-drafted rationale for the Storybook preview.",
    alternativesConsidered: "Status quo; a third-party vendor.",
    risks: "Migration cost; team ramp-up time.",
  },
  "/api/decisions": { ok: true, id: "demo-decision" },
};

const withMockFetch: Decorator = (Story, context) => {
  const overrides = (context.parameters.mockData ?? {}) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key =
      Object.keys(overrides).find((k) => url.includes(k)) ??
      Object.keys(DEFAULT_RESPONSES).find((k) => url.includes(k));
    const body = key ? (overrides[key] ?? DEFAULT_RESPONSES[key]) : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return <Story />;
};

const withToast: Decorator = (Story) => (
  <ToastProvider>
    <Story />
  </ToastProvider>
);

const preview: Preview = {
  decorators: [withMockFetch, withToast],
  parameters: {
    layout: "centered",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/decisions" },
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#f4f5f9" },
        { name: "white", value: "#ffffff" },
        { name: "ink", value: "#0b0b16" },
      ],
    },
    controls: { expanded: true },
    a11y: { test: "todo" },
  },
};

export default preview;
