import type { Meta, StoryObj } from "@storybook/nextjs";
import { Text } from "@/components/ui/text";
import { AppShell } from "./app-shell";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen", nextjs: { navigation: { pathname: "/decisions" } } },
  args: {
    workspaceName: "Acme",
    userName: "Ada Lovelace",
    userEmail: "admin@acme.demo",
    reviewsDue: 3,
    children: null,
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <AppShell {...args}>
      <div className="app-page">
        <div className="page-header">
          <Text as="h1" size="2xl" weight="bold" color="primary">
            Decisions
          </Text>
        </div>
        <Text as="p" size="sm" color="secondary">
          The app shell wraps every protected page: sidebar, sticky top bar, and
          this scrolling content region.
        </Text>
      </div>
    </AppShell>
  ),
};
