import type { Meta, StoryObj } from "@storybook/nextjs";
import { NativeSelect } from "./native-select";

const meta = {
  title: "UI/NativeSelect",
  component: NativeSelect,
  args: { children: <option>Option</option> },
} satisfies Meta<typeof NativeSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <>
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </>
    ),
  },
};

export const WithLabel: Story = {
  args: {
    label: "Role",
    defaultValue: "member",
    children: (
      <>
        <option value="member">Member</option>
        <option value="viewer">Viewer (read-only)</option>
        <option value="admin">Admin</option>
      </>
    ),
  },
};
