import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";
import { describeAuditAction } from "@/lib/audit";

const PAGE_SIZE = 100;

/**
 * Admin-only security audit console. Renders the workspace's most recent audit
 * entries (SOC 2 evidence: who did what, when, from where). Reads straight from
 * the DB - the trail is append-only, so there is nothing to mutate here.
 */
export default async function AuditLogPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/settings");

  const entries = await prisma.auditLog.findMany({
    where: { workspaceId: session.workspaceId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
      </Button>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-500" />
            <Text as="span">Audit log</Text>
          </div>
        }
        description="Immutable, tamper-evident record of security-relevant activity in this workspace - sign-ins, membership, integrations, SSO, and data-subject requests."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8 text-blue-400" />}
          title="No audit events yet"
          description="Security-relevant actions will appear here as they happen."
        />
      ) : (
        <div className="rounded-xs border border-slate-200">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>IP</TableCell>
                <TableCell>Outcome</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Text mono color="muted">{format(e.createdAt, "MMM d, yyyy HH:mm")}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{describeAuditAction(e.action)}</Text>
                  </TableCell>
                  <TableCell>
                    <Text>{e.actorEmail ?? "-"}</Text>
                  </TableCell>
                  <TableCell>
                    <Text color="muted">{e.targetType ?? "-"}</Text>
                  </TableCell>
                  <TableCell>
                    <Text mono color="muted">{e.ip ?? "-"}</Text>
                  </TableCell>
                  <TableCell>
                    {e.outcome === "failure" ? (
                      <Badge className="border-red-200 bg-red-50 text-red-700">failure</Badge>
                    ) : (
                      <Badge>success</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Text as="p" color="muted">
        Showing the {PAGE_SIZE} most recent events. The full trail is retained per the workspace
        data-retention policy and is available in machine-readable form via{" "}
        <Text as="code">GET /api/audit</Text>.
      </Text>
    </PageContainer>
  );
}
