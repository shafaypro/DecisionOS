"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge, Dot } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";

export interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  members: number;
  decisions: number;
}

export function WorkspaceTable({ workspaces }: { workspaces: WorkspaceRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function call(url: string, body?: Record<string, unknown>) {
    const res = await fetch(url, {
      method: body ? "PATCH" : "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Request failed");
    }
    return res;
  }

  async function enter(id: string) {
    setPendingId(id);
    try {
      await call(`/api/platform/workspaces/${id}/enter`);
      // Full navigation so the swapped session cookie is picked up.
      window.location.assign("/decisions");
    } catch (e) {
      toast.error((e as Error).message);
      setPendingId(null);
    }
  }

  function patch(id: string, body: Record<string, unknown>, ok: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await call(`/api/platform/workspaces/${id}`, body);
        toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setPendingId(null);
      }
    });
  }

  if (workspaces.length === 0) {
    return (
      <Text size="sm" color="muted">
        No workspaces yet.
      </Text>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-soft">
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.Cell>Company</Table.Cell>
            <Table.Cell align="right">Members</Table.Cell>
            <Table.Cell align="right">Decisions</Table.Cell>
            <Table.Cell>Status</Table.Cell>
            <Table.Cell align="right">Actions</Table.Cell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {workspaces.map((w) => {
            const busy = pendingId === w.id;
            const suspended = w.status === "suspended";
            return (
              <Table.Row key={w.id}>
                <Table.Cell>
                  <Link href={`/admin/companies/${w.id}`} className="flex items-center gap-3 group">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#dbeafe] shadow-soft">
                      <Text size="sm" weight="semibold" color="brand">
                        {w.name.charAt(0).toUpperCase()}
                      </Text>
                    </div>
                    <div className="flex flex-col">
                      <Text size="sm" weight="medium" color="brand" className="group-hover:underline">
                        {w.name}
                      </Text>
                      <Text size="xs" color="subtle" mono>
                        {w.slug}
                      </Text>
                    </div>
                  </Link>
                </Table.Cell>
                <Table.Cell align="right">
                  <Text size="sm" color="secondary">
                    {w.members}
                  </Text>
                </Table.Cell>
                <Table.Cell align="right">
                  <Text size="sm" color="secondary">
                    {w.decisions}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    icon={<Dot className={suspended ? "bg-red-500" : "bg-emerald-500"} />}
                    className={suspended ? "text-red-600" : "text-emerald-700"}
                  >
                    {suspended ? "suspended" : "active"}
                  </Badge>
                </Table.Cell>
                <Table.Cell align="right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant={suspended ? "outline" : "ghost"}
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        patch(
                          w.id,
                          { status: suspended ? "active" : "suspended" },
                          suspended ? `${w.name} reactivated` : `${w.name} suspended`,
                        )
                      }
                    >
                      {suspended ? "Reactivate" : "Suspend"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<LogIn className="h-3.5 w-3.5" />}
                      disabled={busy}
                      onClick={() => enter(w.id)}
                    >
                      Enter
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </div>
  );
}
