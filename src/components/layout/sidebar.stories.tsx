import type { Meta, StoryObj } from "@storybook/nextjs";
import { Sidebar } from "./sidebar";

const meta = {
  title: "Layout/Sidebar",
  component: Sidebar,
  parameters: { layout: "fullscreen", backgrounds: { default: "light" } },
  args: {
    workspaceName: "Acme",
    userName: "Ada Lovelace",
    userEmail: "admin@acme.demo",
    reviewsDue: 3,
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="h-screen w-72">
      <Sidebar {...args} />
    </div>
  ),
};

export const NoReviewsDue: Story = { ...Default, args: { reviewsDue: 0 } };
