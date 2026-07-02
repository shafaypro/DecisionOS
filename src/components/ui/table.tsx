"use client";

import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";

// Which section a cell lives in. Head cells render <th>; body cells render <td>.
// Provided by Table.Head / Table.Body, read by Table.Cell and Table.Row.
const TableSection = createContext<{ header: boolean }>({ header: false });

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <TableSection.Provider value={{ header: true }}>
      <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>
    </TableSection.Provider>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <TableSection.Provider value={{ header: false }}>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </TableSection.Provider>
  );
}

function TableRow({
  children,
  onClick,
  selected = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const { header } = useContext(TableSection);
  const interactive = !header && !!onClick;
  return (
    <tr
      onClick={header ? undefined : onClick}
      className={cn(
        !header && "group transition-colors hover:bg-slate-50",
        !header && selected && "bg-blue-50",
        interactive && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" };

function Cell({
  children,
  align = "left",
  colSpan,
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  colSpan?: number;
  className?: string;
}) {
  const { header } = useContext(TableSection);
  const cls = cn("px-4 py-3", alignClass[align], className);
  if (header) {
    return (
      <th colSpan={colSpan} className={cls}>
        <Text>{children}</Text>
      </th>
    );
  }
  return (
    <td colSpan={colSpan} className={cls}>
      {children}
    </td>
  );
}

Table.Head = Head;
Table.Body = Body;
Table.Row = TableRow;
Table.Cell = Cell;
