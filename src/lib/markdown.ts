/**
 * Minimal, dependency-free Markdown renderer for user-authored prose.
 *
 * Decision records are written in prose - rationale, risks, notes - and people
 * naturally type Markdown into them. Rendering it turns a wall of asterisks into
 * a readable record. We do NOT pull in a Markdown library for this: the input is
 * untrusted user content rendered inside the app shell, and a full parser plus a
 * sanitizer is a large attack surface for a feature that needs a dozen
 * constructs.
 *
 * The safety model is deliberately simple and auditable:
 *
 *   1. The whole input is HTML-escaped FIRST. After that step no user byte can
 *      ever become a tag, an attribute, or an entity - so no sanitizer is needed
 *      and there is no "did we cover that vector?" question.
 *   2. Only the tags this module emits itself exist in the output.
 *   3. Link hrefs are the one place a user value lands in an attribute, so they
 *      go through `safeHref`, which allows http/https/mailto only - blocking
 *      `javascript:`, `data:`, and protocol-relative tricks.
 *
 * Supported: headings (#-######), bullet and numbered lists, blockquotes, fenced
 * and inline code, bold, italic, strikethrough, links, autolinks, horizontal
 * rules, and paragraphs. Anything else renders as literal text, which for a
 * decision log is the right failure mode.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape every HTML-significant character. Always the first step. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Allow only schemes that can't execute script. Returns null when unsafe. */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  // Protocol-relative URLs inherit the page scheme and hide the real host.
  if (trimmed.startsWith("//")) return null;
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  // Bare domains and relative paths are fine; anything with a scheme is not.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return trimmed;
}

/** Inline constructs, applied to already-escaped text. */
function renderInline(escaped: string): string {
  let out = escaped;

  // Inline code first - its contents must not be re-processed for emphasis.
  const codeSpans: string[] = [];
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  // [label](url) - the only place a user value reaches an attribute.
  //
  // `href` here is already HTML-escaped (the whole input was escaped up front),
  // which is exactly the form an attribute value needs: the browser decodes
  // `&amp;` back to `&` when it reads the attribute. So it is emitted as-is,
  // with no unescape/re-escape round trip - that round trip is how double-
  // unescaping bugs (and the `&amp;amp;` class of mangled links) get in.
  // Escaping cannot hide a scheme from `safeHref` either: it only rewrites
  // `& < > " '`, so a `javascript:` prefix survives escaping unchanged and is
  // still matched, while an entity a user typed literally stays inert text.
  out = out.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_whole, label: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });

  // Bare URLs. Same reasoning: the matched text is already escaped.
  out = out.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_m, lead: string, url: string) =>
    `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`,
  );

  out = out
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, i: string) => `<code>${codeSpans[Number(i)]}</code>`);
  return out;
}

/** Hard cap so a pathological paste can't spend unbounded CPU on render. */
const MAX_INPUT = 200_000;

/**
 * Render Markdown to a safe HTML string.
 *
 * The result contains only tags emitted by this module and is safe to pass to
 * `dangerouslySetInnerHTML` - the name is a warning about the mechanism, not
 * about this input.
 */
export function renderMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  // Strip NUL so the inline-code placeholder below cannot be forged by input.
  const source = (input.length > MAX_INPUT ? input.slice(0, MAX_INPUT) : input).replace(/\u0000/g, "");
  const lines = escapeHtml(source).replace(/\r\n?/g, "\n").split("\n");

  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inQuote = false;
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      html.push("</blockquote>");
      inQuote = false;
    }
  };
  const closeBlocks = () => {
    flushParagraph();
    closeList();
    closeQuote();
  };

  for (const line of lines) {
    // Fenced code block - contents are emitted verbatim (already escaped).
    if (/^\s*```/.test(line)) {
      if (fence === null) {
        closeBlocks();
        fence = [];
      } else {
        html.push(`<pre><code>${fence.join("\n")}</code></pre>`);
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      fence.push(line);
      continue;
    }

    if (line.trim() === "") {
      closeBlocks();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeBlocks();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      closeBlocks();
      html.push("<hr />");
      continue;
    }

    const quote = /^\s*&gt;\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      closeList();
      if (!inQuote) {
        html.push("<blockquote>");
        inQuote = true;
      }
      html.push(`<p>${renderInline(quote[1])}</p>`);
      continue;
    }
    closeQuote();

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const wanted: "ul" | "ol" = bullet ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        html.push(`<${wanted}>`);
        listType = wanted;
      }
      html.push(`<li>${renderInline((bullet ?? numbered)![1])}</li>`);
      continue;
    }
    closeList();

    paragraph.push(line.trim());
  }

  if (fence !== null) html.push(`<pre><code>${fence.join("\n")}</code></pre>`);
  closeBlocks();

  return html.join("\n");
}

/**
 * Strip Markdown down to plain text - for previews, search snippets, emails,
 * and anywhere HTML would be noise.
 */
export function markdownToPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*&gt;\s?/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rough reading time in minutes (200 wpm), floored at 1 for non-empty text. */
export function readingTimeMinutes(input: string | null | undefined): number {
  const words = markdownToPlainText(input).split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 200));
}
