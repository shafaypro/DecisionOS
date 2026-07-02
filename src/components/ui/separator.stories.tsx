import type { Meta, StoryObj } from "@storybook/nextjs";
import { Text } from "@/components/ui/text";
import { Separator } from "./separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-64">
      <Text as="p" size="sm" color="secondary">
        Decision details
      </Text>
      <Separator className="my-3" />
      <Text as="p" size="sm" color="secondary">
        Related decisions
      </Text>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3">
      <Text as="span" size="sm" color="secondary">
        Owner
      </Text>
      <Separator orientation="vertical" />
      <Text as="span" size="sm" color="secondary">
        Reviewers
      </Text>
      <Separator orientation="vertical" />
      <Text as="span" size="sm" color="secondary">
        Tags
      </Text>
    </div>
  ),
};
