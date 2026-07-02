import type { Meta, StoryObj } from "@storybook/nextjs";
import { Skeleton, SkeletonCard } from "./skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Line: Story = { args: { className: "h-4 w-48" } };

export const TextBlock: Story = {
  render: () => (
    <div className="w-64 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  ),
};

export const Card: Story = {
  render: () => (
    <SkeletonCard className="w-72">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </SkeletonCard>
  ),
};
