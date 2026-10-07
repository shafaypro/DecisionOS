/**
 * Send a JSON request from a client component and reduce the outcome to a
 * single error message (or null on success). Never throws, so call sites can do
 * `const err = await sendJson(...); if (err) toast.error(err);` instead of
 * silently ignoring failed mutations.
 */
export async function sendJson(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    return typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}
