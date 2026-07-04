"use client";

/**
 * Root error boundary. Catches errors thrown while rendering the root layout
 * itself (where a segment-level error.tsx can't help). Next requires this file
 * to render its own <html>/<body>. Kept dependency-free so it can't fail for the
 * same reason the app just did.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#475569", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            An unexpected error occurred. Try again — if it keeps happening, contact
            your workspace admin.
          </p>
          {error?.digest && (
            <p style={{ color: "#94a3b8", fontSize: "0.75rem", marginBottom: "1.5rem" }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.25rem",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
