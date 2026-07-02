"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus } from "lucide-react";
import { Text } from "@/components/ui/text";

interface NoteReplyFormProps {
  noteId: string;
  onAdded?: () => void;
}

export function NoteReplyForm({ noteId, onAdded }: NoteReplyFormProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!content.trim()) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/decisions/notes/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content }),
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setContent("");
        setOpen(false);
        onAdded?.();
        // Reload to show new reply
        window.location.reload();
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 mt-1 text-text-brand hover:text-text-brand"
      >
        <MessageSquarePlus className="h-3 w-3" />
        <Text>Reply</Text>
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a reply..."
        rows={2}
        autoFocus
      />
      {error && <Text as="p">{error}</Text>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || !content.trim()} onClick={submit}>
          Post reply
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setContent(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
