import type { Meta, StoryObj } from "@storybook/nextjs";
import { Sparkline } from "./sparkline";

const meta = {
  title: "UI/Sparkline",
  component: Sparkline,
  args: {
    values: [2, 5, 3, 8, 6, 9, 12, 7, 11, 14, 10, 16],
    width: 240,
    height: 40,
    label: "Decisions logged per month",
  },
  argTypes: {
    stroke: { control: "color" },
    fill: { control: "boolean" },
  },
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const ReviewsCompleted: Story = {
  args: { values: [0, 1, 0, 3, 2, 4, 1, 5, 3, 6, 4, 7], stroke: "#10b981" },
};

export const Declining: Story = {
  args: { values: [16, 14, 15, 11, 9, 10, 6, 5, 4, 3, 2, 1], stroke: "#f59e0b" },
};

export const FlatSeries: Story = {
  name: "Flat series (no divide-by-zero)",
  args: { values: [4, 4, 4, 4, 4, 4] },
};

export const SinglePoint: Story = {
  name: "Single point (centered)",
  args: { values: [5] },
};

export const AllZero: Story = {
  args: { values: [0, 0, 0, 0] },
};
