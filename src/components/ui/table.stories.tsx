import type { Meta, StoryObj } from "@storybook/nextjs";
import { Badge } from "@/components/ui/badge";
import { Table } from "./table";

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
  args: { children: null },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = [
  { id: "1", title: "Adopt Postgres", status: "Decided", owner: "Alice", score: 92 },
  { id: "2", title: "Drop legacy API", status: "Proposed", owner: "Bob", score: 71 },
  { id: "3", title: "Rename workspace", status: "Blocked", owner: "Carol", score: 48 },
];

export const Default: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.Cell>Title</Table.Cell>
          <Table.Cell>Status</Table.Cell>
          <Table.Cell className="hidden md:table-cell">Owner</Table.Cell>
          <Table.Cell align="right">Score</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map((r, i) => (
          <Table.Row key={r.id} selected={i === 0} onClick={() => {}}>
            <Table.Cell>{r.title}</Table.Cell>
            <Table.Cell>
              <Badge>{r.status}</Badge>
            </Table.Cell>
            <Table.Cell className="hidden md:table-cell">{r.owner}</Table.Cell>
            <Table.Cell align="right">{r.score}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  ),
};

// Empty body via a colSpan cell - the call-site empty-row pattern.
export const EmptyRow: Story = {
  render: () => (
    <Table>
      <Table.Head>
        <Table.Row>
          <Table.Cell>Title</Table.Cell>
          <Table.Cell>Status</Table.Cell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        <Table.Row>
          <Table.Cell colSpan={2} align="center">
            No decisions yet.
          </Table.Cell>
        </Table.Row>
      </Table.Body>
    </Table>
  ),
};
