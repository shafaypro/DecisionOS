import type { Meta, StoryObj } from "@storybook/nextjs";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: { placeholder: "Describe the rationale…", rows: 4 },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = {
  args: {
    defaultValue:
      "We chose Postgres for concurrent writes and managed backups; SQLite blocked our scaling path.",
  },
};
export const Disabled: Story = { args: { disabled: true, defaultValue: "Read-only" } };

export const WithLabel: Story = {
  args: {
    label: "Rationale",
    placeholder: "Why was this the right call?",
    rows: 4,
  },
};

export const WithLabelAndHint: Story = {
  args: {
    label: "What happened?",
    placeholder: "Summarize how the decision played out in practice",
    hint: "Two or three direct sentences are enough.",
    rows: 3,
  },
};
