"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Reply as ReplyIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/text";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ErrorAlert } from "@/components/ui/error-alert";
import { formatRelativeDate } from "@/lib/utils";

export interface NoteReplyRow {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
}

/**
 * Threaded replies under a decision note: the reply list plus an inline
 * composer. The server component passes the pre-fetched replies; mutations go
 * through /api/decisions/notes/replies and re-read via router.refresh().
 */
export function NoteReplies({
  noteId,
  replies,
  currentUserId,
  isAdmin,
  readOnly = false,
}: {
  noteId: string;
  replies: NoteReplyRow[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly?: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (readOnly && replies.length === 0) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const content = (form.elements.namedItem("content") as HTMLTextAreaElement)?.value?.trim();
    if (!content) { setError("Reply content is required."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/decisions/notes/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setComposing(false);
        router.refresh();
      }
    });
  }

  function handleDelete(replyId: string) {
    if (!confirm("Delete this reply?")) return;
    startTransition(async () => {
      await fetch("/api/decisions/notes/replies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
      });
      router.refresh();
    });
  }

  return (
    <div className="mt-2 space-y-2 border-l-2 border-slate-100 pl-4">
      {replies.map((reply) => (
        <div key={reply.id} className="flex gap-2 group/reply">
          <Avatar className="h-5 w-5">
            <AvatarFallback>{reply.user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text weight="medium">{reply.user.name}</Text>
              <Text color="subtle">{formatRelativeDate(reply.createdAt)}</Text>
              {!readOnly && (reply.user.id === currentUserId || isAdmin) && (
                <button
                  disabled={pending}
                  onClick={() => handleDelete(reply.id)}
                  className="opacity-0 group-hover/reply:opacity-100 transition-opacity text-slate-400 hover:text-red-500 disabled:opacity-30"
                  title="Delete reply"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Text as="p">{reply.content}</Text>
          </div>
        </div>
      ))}

      {!readOnly && (
        composing ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <ErrorAlert error={error} />
            <Textarea
              name="content"
              placeholder="Write a reply…"
              rows={2}
              required
              autoFocus
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Replying…" : "Reply"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => { setComposing(false); setError(undefined); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<ReplyIcon className="h-3.5 w-3.5" />}
            onClick={() => setComposing(true)}
          >
            Reply
          </Button>
        )
      )}
    </div>
  );
}
