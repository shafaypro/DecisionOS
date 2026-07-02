import type { Meta, StoryObj } from "@storybook/nextjs";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://i.pravatar.cc/64?img=12" alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  ),
};

export const Group: Story = {
  render: () => (
    <div className="flex -space-x-2">
      <Avatar className="ring-2 ring-white">
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-white">
        <AvatarFallback>GH</AvatarFallback>
      </Avatar>
      <Avatar className="ring-2 ring-white">
        <AvatarFallback>+3</AvatarFallback>
      </Avatar>
    </div>
  ),
};
