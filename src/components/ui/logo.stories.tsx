import type { Meta, StoryObj } from "@storybook/nextjs";
import { LogoMark, Wordmark } from "./logo";

const meta = {
  title: "UI/Logo",
  component: LogoMark,
  argTypes: {
    size: { control: { type: "range", min: 16, max: 128, step: 4 } },
    glow: { control: "boolean" },
  },
  args: { size: 48, glow: true },
} satisfies Meta<typeof LogoMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Mark: Story = {};
export const NoGlow: Story = { args: { glow: false } };
export const Large: Story = { args: { size: 96 } };

export const Lockup: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <LogoMark size={40} />
      <Wordmark size="2xl" />
    </div>
  ),
};

export const OnInk: Story = {
  parameters: { backgrounds: { default: "ink" } },
  render: () => (
    <div className="flex items-center gap-3">
      <LogoMark size={40} />
      <Wordmark size="2xl" />
    </div>
  ),
};
