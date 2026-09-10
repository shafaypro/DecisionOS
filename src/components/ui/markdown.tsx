import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

/**
 * Render user-authored Markdown (decision fields, notes, review summaries).
 *
 * `dangerouslySetInnerHTML` is used deliberately: `renderMarkdown` escapes the
 * entire input before it emits a single tag, so the HTML reaching this component
 * contains only the tags the renderer itself produced - see lib/markdown.ts for
 * the safety argument. Passing arbitrary HTML here would not be safe; passing
 * this renderer's output is.
 *
 * Styling is applied with explicit descendant selectors rather than a typography
 * plugin so the output matches the app's own type scale.
 */
export function Markdown({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const html = renderMarkdown(text);
  if (!html) return null;

  return (
    <div
      className={cn(
        "text-sm leading-relaxed text-text-primary",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[15px] [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:text-sm [&_h4]:font-semibold",
        "[&_h5]:mt-3 [&_h5]:mb-1.5 [&_h5]:text-sm [&_h5]:font-semibold",
        "[&_h6]:mt-3 [&_h6]:mb-1.5 [&_h6]:text-sm [&_h6]:font-semibold",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-text-muted",
        "[&_code]:rounded-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xs [&_pre]:bg-slate-50 [&_pre]:p-3",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700",
        "[&_hr]:my-4 [&_hr]:border-slate-200",
        "[&_strong]:font-semibold",
        "[&_del]:text-text-subtle",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
