import type { Meta, StoryObj } from "@storybook/nextjs";
import Link from "next/link";
import { Sparkles, Network, GitCommit, Plus, FileText, Search } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Button } from "./button";
import { Text } from "./text";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

const newDecision = (
  <Button asChild>
    <Link href="/decisions/new">
      <Plus className="h-4 w-4" />
      <Text color="inherit" size="sm" weight="semibold">New decision</Text>
    </Link>
  </Button>
);

export const WithAction: Story = {
  args: {
    icon: <Sparkles className="h-8 w-8 text-blue-400" />,
    title: "Nothing to score yet",
    description: "Log your first decision to start seeing health signals here.",
    action: newDecision,
  },
};

export const NoAction: Story = {
  args: {
    icon: <GitCommit className="h-8 w-8 text-blue-400" />,
    title: "No edits recorded",
    description: "Every change made after this decision was first created will appear here.",
  },
};

export const Graph: Story = {
  args: {
    icon: <Network className="h-8 w-8 text-blue-400" />,
    title: "No decisions to map yet",
    description: "Log a few decisions and link them with relations to see the graph come alive.",
    action: newDecision,
  },
};

// Hero variant: larger title, two-line copy, more padding.
export const Hero: Story = {
  args: {
    size: "lg",
    icon: <FileText className="h-8 w-8 text-blue-400" />,
    title: "Start your decision log",
    description: "What is the most important technical or product decision your team made in the last 30 days?",
    hint: "Log it now. It takes under 3 minutes and future teammates get the context immediately.",
    action: (
      <Button size="lg" asChild>
        <Link href="/decisions/new">
          <Plus className="h-4 w-4" />
          <Text color="inherit" size="sm" weight="semibold">Log your first decision</Text>
        </Link>
      </Button>
    ),
  },
};

// Bare icon (no tile), used for "no results" states.
export const NoTile: Story = {
  args: {
    tile: false,
    icon: <Search className="h-10 w-10 text-slate-300" />,
    title: "No decisions match this view",
    description: "Change the focus, clear filters, or capture the decision you expected to find.",
    action: (
      <Button variant="outline" size="sm" asChild>
        <Link href="/decisions">
          <Text color="inherit" size="xs" weight="semibold">Clear filters</Text>
        </Link>
      </Button>
    ),
  },
};
