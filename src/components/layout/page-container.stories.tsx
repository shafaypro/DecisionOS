import type { Meta, StoryObj } from "@storybook/nextjs";
import { Text } from "@/components/ui/text";
import { PageContainer } from "./page-container";

const meta = {
  title: "Layout/PageContainer",
  component: PageContainer,
  parameters: { layout: "fullscreen", backgrounds: { default: "light" } },
} satisfies Meta<typeof PageContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: null },
  render: () => (
    <PageContainer>
      <Text as="h1" size="2xl" weight="semibold" color="primary">
        Page title
      </Text>
      <div className="rounded-xs transition-all duration-200 p-6">
        <Text size="sm" color="secondary">
          First section
        </Text>
      </div>
      <div className="rounded-xs transition-all duration-200 p-6">
        <Text size="sm" color="secondary">
          Second section - note the gap-6 rhythm between blocks
        </Text>
      </div>
    </PageContainer>
  ),
};
