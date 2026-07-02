import type { Meta, StoryObj } from "@storybook/nextjs";
import { DecisionGraphCanvas } from "./decision-graph-canvas";

const decisions = [
  { id: "d1", title: "Migrate to Postgres", status: "approved", category: "engineering", ownerName: "Ada Lovelace" },
  { id: "d2", title: "Adopt feature flags", status: "approved", category: "engineering", ownerName: "Grace Hopper" },
  { id: "d3", title: "Use SQLite for v1", status: "superseded", category: "engineering", ownerName: "Alan Turing" },
  { id: "d4", title: "Quarterly review cadence", status: "proposed", category: "operations", ownerName: "Ada Lovelace" },
  { id: "d5", title: "Pricing: three tiers", status: "approved", category: "business", ownerName: "Grace Hopper" },
  { id: "d6", title: "Drop the free plan", status: "rejected", category: "business", ownerName: null },
];

const relations = [
  { fromDecisionId: "d1", toDecisionId: "d3", relationType: "supersedes" },
  { fromDecisionId: "d2", toDecisionId: "d1", relationType: "depends_on" },
  { fromDecisionId: "d4", toDecisionId: "d1", relationType: "relates_to" },
  { fromDecisionId: "d6", toDecisionId: "d5", relationType: "conflicts_with" },
];

const meta = {
  title: "Graph/DecisionGraphCanvas",
  component: DecisionGraphCanvas,
  parameters: { layout: "fullscreen" },
  args: { decisions, relations, connectedOnly: false },
} satisfies Meta<typeof DecisionGraphCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullGraph: Story = {
  render: (args) => (
    <div className="h-[600px] w-full">
      <DecisionGraphCanvas {...args} />
    </div>
  ),
};

export const ConnectedOnly: Story = {
  ...FullGraph,
  args: { connectedOnly: true },
};
