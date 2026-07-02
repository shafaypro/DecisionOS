"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { AlertCircle, Plus } from "lucide-react";

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b",
];

export function CreateTagForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const router = useRouter();

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Tag name is required."); return; }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setName("");
        setColor("#6366f1");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-end gap-3 flex-wrap">
      {error && (
        <div className="w-full flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-text-danger" />
          <Text>{error}</Text>
        </div>
      )}
      <Input
        label="Tag name"
        fieldClassName="space-y-1"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. security, performance"
        className="h-8 w-48"
      />
      <NativeSelect
        label="Color"
        fieldClassName="space-y-1"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-8 w-32 px-2"
      >
        {TAG_COLORS.map((c) => (
          <option key={c} value={c} style={{ backgroundColor: c, color: "#fff" }}>
            {c}
          </option>
        ))}
      </NativeSelect>
      <Button size="sm" disabled={pending} onClick={handleCreate}>
        <Plus className="h-3.5 w-3.5" />
        {pending ? "Creating…" : "Create Tag"}
      </Button>
    </div>
  );
}
