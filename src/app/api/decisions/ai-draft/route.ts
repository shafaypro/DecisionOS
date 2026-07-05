import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isViewer, isPlatformAdmin, VIEWER_ERROR } from "@/lib/auth-guards";
import { revalidateWorkspaceAccess } from "@/lib/access-control";
import { resolveAnthropicConfig } from "@/lib/anthropic";
import { logger } from "@/lib/logger";
import { aiDraftLimiter, mutationKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isViewer(session.role)) return NextResponse.json(VIEWER_ERROR, { status: 403 });
  if (!isPlatformAdmin(session.platformRole)) {
    const access = await revalidateWorkspaceAccess(session.userId, session.workspaceId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const limit = await aiDraftLimiter.check(mutationKey(session));
  if (!limit.ok) {
    return NextResponse.json(
      { error: "AI drafting is rate-limited. Please wait a moment before trying again." },
      { status: 429, headers: limit.headers },
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";
  const category = typeof body?.category === "string" ? body.category : "";
  if (!title.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const resolved = await resolveAnthropicConfig(session.workspaceId);
  if (!resolved) {
    return NextResponse.json(
      { error: "AI drafting is not configured. Ask your admin to add an Anthropic API key in Settings → Integrations." },
      { status: 503 }
    );
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: resolved.apiKey,
      ...(resolved.baseUrl ? { baseURL: resolved.baseUrl } : {}),
    });

    const prompt = `You are helping a team document a decision. Given the following decision title and category, generate structured content to help draft the decision record.

Decision Title: ${title.trim()}
Category: ${category || "general"}

Generate a JSON object with these fields:
- problemStatement: A concise description of the problem or opportunity being addressed (2-4 sentences)
- chosenOption: The recommended approach or solution (1-3 sentences)
- rationale: Why this option was chosen over alternatives (2-4 sentences)
- alternativesConsidered: 2-3 alternative approaches that were considered (as a bulleted list in plain text)
- assumptions: Key assumptions underlying this decision (as a bulleted list in plain text)
- risks: Potential risks and mitigation strategies (as a bulleted list in plain text)

Return ONLY valid JSON, no markdown, no code blocks.`;

    const message = await client.messages.create({
      model: resolved.model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    let draft: Record<string, string>;
    try {
      draft = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: "AI returned an unexpected response. Please try again." }, { status: 500 });
      draft = JSON.parse(match[0]);
    }

    return NextResponse.json({ success: true, draft, model: resolved.model });
  } catch (err: unknown) {
    logger.error("ai_draft_failed", {
      workspaceId: session.workspaceId,
      userId: session.userId,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "AI draft failed. Please try again or contact your admin if the issue persists." },
      { status: 500 }
    );
  }
}
