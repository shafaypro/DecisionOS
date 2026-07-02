import type { Meta, StoryObj } from "@storybook/nextjs";
import { Text } from "@/components/ui/text";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  args: { placeholder: "Decision title…" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithValue: Story = { args: { defaultValue: "Migrate to Postgres" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "Locked" } };
export const Email: Story = { args: { type: "email", placeholder: "you@team.com" } };

export const WithLabel: Story = {
  args: {
    label: "Decision title",
    placeholder: "Migrate to Postgres",
  },
};

export const WithLabelAndHint: Story = {
  args: {
    label: "Workspace name",
    placeholder: "Acme Inc",
    hint: "Your company or team name",
  },
};

export const WithRequiredLabel: Story = {
  args: {
    label: (
      <>
        What was decided? <Text as="span" color="danger">*</Text>
      </>
    ),
    placeholder: "e.g. Migrate to PostgreSQL",
  },
};
