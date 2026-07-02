"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  STATUS_COLORS, OUTCOME_COLORS, IMPACT_COLORS, CATEGORY_COLORS,
  STATUSES, OUTCOME_STATUSES, IMPACT_LEVELS, CATEGORIES,
  getLabelForValue,
} from "@/lib/utils";
import { BulkActionBar } from "./bulk-action-bar";
import { Text } from "@/components/ui/text";
import { Table } from "@/components/ui/table";

interface Decision {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  category: string;
  impactLevel: string;
  outcomeStatus: string | null | undefined;
  reviewDate: Date | null;
  updatedAt: Date;
  owner: { id: string; name: string } | null;
  _count: { notes: number; reviews: number };
}

interface DecisionsTableProps {
  decisions: Decision[];
  isViewer: boolean;
}

export function DecisionsTable({ decisions, isViewer }: DecisionsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const router = useRouter();

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedIds.length === decisions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(decisions.map((d) => d.id));
    }
  }

  const allSelected = decisions.length > 0 && selectedIds.length === decisions.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < decisions.length;

  return (
    <>
      <Table>
        <Table.Head>
          <Table.Row>
            {!isViewer && (
              <Table.Cell className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="rounded-xs border-slate-300"
                />
              </Table.Cell>
            )}
            <Table.Cell>Title</Table.Cell>
            <Table.Cell className="hidden md:table-cell">Category</Table.Cell>
            <Table.Cell>Status</Table.Cell>
            <Table.Cell className="hidden lg:table-cell">Owner</Table.Cell>
            <Table.Cell className="hidden lg:table-cell">Impact</Table.Cell>
            <Table.Cell className="hidden xl:table-cell">Review Date</Table.Cell>
            <Table.Cell className="hidden xl:table-cell">Outcome</Table.Cell>
            <Table.Cell className="hidden lg:table-cell">Updated</Table.Cell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {decisions.map((d) => (
            <Table.Row key={d.id} selected={selectedIds.includes(d.id)}>
              {!isViewer && (
                <Table.Cell>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    className="rounded-xs border-slate-300"
                  />
                </Table.Cell>
              )}
              <Table.Cell>
                <Link href={`/decisions/${d.id}`} className="block">
                  <Text as="p">
                    {d.title}
                  </Text>
                  {d.summary && (
                    <Text as="p">{d.summary}</Text>
                  )}
                </Link>
              </Table.Cell>
              <Table.Cell className="hidden md:table-cell">
                <Badge className={CATEGORY_COLORS[d.category] ?? "bg-slate-100 text-slate-600"}>
                  {getLabelForValue(CATEGORIES, d.category)}
                </Badge>
              </Table.Cell>
              <Table.Cell>
                <Badge className={STATUS_COLORS[d.status] ?? "bg-slate-100 text-slate-600"}>
                  {getLabelForValue(STATUSES, d.status)}
                </Badge>
              </Table.Cell>
              <Table.Cell className="hidden lg:table-cell">
                <Text>{d.owner?.name ?? "-"}</Text>
              </Table.Cell>
              <Table.Cell className="hidden lg:table-cell">
                <Badge className={IMPACT_COLORS[d.impactLevel] ?? "bg-slate-100 text-slate-600"}>
                  {`${getLabelForValue(IMPACT_LEVELS, d.impactLevel)} Impact`}
                </Badge>
              </Table.Cell>
              <Table.Cell className="hidden xl:table-cell">
                <Text>{d.reviewDate ? formatDate(d.reviewDate) : "-"}</Text>
              </Table.Cell>
              <Table.Cell className="hidden xl:table-cell">
                <Badge className={OUTCOME_COLORS[d.outcomeStatus ?? "unknown"] ?? "bg-slate-100 text-slate-600"}>
                  {getLabelForValue(OUTCOME_STATUSES, d.outcomeStatus ?? "unknown")}
                </Badge>
              </Table.Cell>
              <Table.Cell className="hidden lg:table-cell">
                <Text>{formatDate(d.updatedAt)}</Text>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {!isViewer && (
        <BulkActionBar
          selectedIds={selectedIds}
          decisions={decisions}
          onClear={() => setSelectedIds([])}
          onDone={() => { setSelectedIds([]); router.refresh(); }}
        />
      )}
    </>
  );
}
