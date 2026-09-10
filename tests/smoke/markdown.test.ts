import {
  escapeHtml,
  markdownToPlainText,
  readingTimeMinutes,
  renderMarkdown,
  safeHref,
} from "../../src/lib/markdown";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

export const markdownTests = {
  "escapes HTML before anything else - no raw tag can survive": () => {
    const out = renderMarkdown('<script>alert("xss")</script>');
    assert(!out.includes("<script>"), "script tag never emitted");
    assert(out.includes("&lt;script&gt;"), "escaped instead");
  },

  "escapes attribute-breaking characters": () => {
    assert(escapeHtml(`<a href="x" onload='y'>&`) === "&lt;a href=&quot;x&quot; onload=&#39;y&#39;&gt;&amp;", "all five escaped");
  },

  "safeHref allows http/https/mailto and relative paths": () => {
    assert(safeHref("https://example.com") === "https://example.com", "https ok");
    assert(safeHref("mailto:a@b.com") === "mailto:a@b.com", "mailto ok");
    assert(safeHref("/decisions/123") === "/decisions/123", "relative ok");
  },

  "safeHref blocks javascript:, data:, and protocol-relative URLs": () => {
    assert(safeHref("javascript:alert(1)") === null, "javascript blocked");
    assert(safeHref("  JavaScript:alert(1)") === null, "case/whitespace variant blocked");
    assert(safeHref("data:text/html;base64,PHN2Zz4=") === null, "data blocked");
    assert(safeHref("//evil.example.com") === null, "protocol-relative blocked");
  },

  "a javascript: link renders as plain label, never as an anchor": () => {
    const out = renderMarkdown("[click me](javascript:alert(1))");
    assert(!out.includes("<a "), "no anchor emitted");
    assert(out.includes("click me"), "label preserved as text");
  },

  "renders links with noopener/noreferrer": () => {
    const out = renderMarkdown("[docs](https://example.com/x)");
    assert(out.includes('href="https://example.com/x"'), "href set");
    assert(out.includes('rel="noopener noreferrer nofollow"'), "rel hardened");
  },

  "renders headings, bullets, numbered lists, and blockquotes": () => {
    const out = renderMarkdown("## Why\n\n- one\n- two\n\n1. first\n\n> quoted");
    assert(out.includes("<h2>Why</h2>"), "heading");
    assert(out.includes("<ul>") && out.includes("<li>one</li>"), "bullet list");
    assert(out.includes("<ol>") && out.includes("<li>first</li>"), "numbered list");
    assert(out.includes("<blockquote>"), "blockquote");
  },

  "renders emphasis, strikethrough, and inline code": () => {
    const out = renderMarkdown("**bold** and *italic* and ~~gone~~ and `code`");
    assert(out.includes("<strong>bold</strong>"), "bold");
    assert(out.includes("<em>italic</em>"), "italic");
    assert(out.includes("<del>gone</del>"), "strikethrough");
    assert(out.includes("<code>code</code>"), "inline code");
  },

  "inline code contents are not re-processed for emphasis": () => {
    const out = renderMarkdown("`a * b * c`");
    assert(out.includes("<code>a * b * c</code>"), "asterisks left alone inside code");
    assert(!out.includes("<em>"), "no emphasis inside code");
  },

  "fenced code blocks render verbatim and escaped": () => {
    const out = renderMarkdown("```\n<b>hi</b>\n```");
    assert(out.includes("<pre><code>"), "pre/code emitted");
    assert(out.includes("&lt;b&gt;hi&lt;/b&gt;"), "contents escaped");
  },

  "an unterminated code fence still closes cleanly": () => {
    const out = renderMarkdown("```\nstill open");
    assert(out.includes("<pre><code>still open</code></pre>"), "fence auto-closed");
  },

  "paragraphs are separated by blank lines": () => {
    const out = renderMarkdown("one\ntwo\n\nthree");
    assert(out.includes("<p>one two</p>"), "soft-wrapped lines join");
    assert(out.includes("<p>three</p>"), "blank line starts a new paragraph");
  },

  "empty and null input render as an empty string": () => {
    assert(renderMarkdown("") === "", "empty");
    assert(renderMarkdown(null) === "", "null");
    assert(renderMarkdown(undefined) === "", "undefined");
  },

  "markdownToPlainText strips syntax for previews": () => {
    const text = markdownToPlainText("## Title\n\n- **bold** [link](https://x.com)\n\n`code`");
    assert(!text.includes("#") && !text.includes("*"), "syntax removed");
    assert(text.includes("bold"), "content kept");
    assert(text.includes("link"), "link label kept");
    assert(!text.includes("https://x.com"), "link target dropped");
  },

  "readingTime is 0 for empty text and at least 1 for any content": () => {
    assert(readingTimeMinutes("") === 0, "empty is zero");
    assert(readingTimeMinutes("a few words here") === 1, "short text floors at one minute");
    assert(readingTimeMinutes(Array(600).fill("word").join(" ")) === 3, "600 words ≈ 3 min");
  },
};
