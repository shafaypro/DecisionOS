import type { Meta, StoryObj } from "@storybook/nextjs";
import { Text } from "./text";
import { TEXT_SIZE, TEXT_COLOR, FONT_WEIGHT, LEADING, TRACKING } from "@/lib/typography";

const meta = {
  title: "UI/Typography",
  component: Text,
  args: { children: "DecisionOS typography", size: "base", color: "primary" },
  argTypes: {
    size: { control: "select", options: Object.keys(TEXT_SIZE) },
    color: { control: "select", options: Object.keys(TEXT_COLOR) },
    weight: { control: "select", options: [undefined, ...Object.keys(FONT_WEIGHT)] },
    leading: { control: "select", options: [undefined, ...Object.keys(LEADING)] },
    tracking: { control: "select", options: [undefined, ...Object.keys(TRACKING)] },
    truncate: { control: "boolean" },
    uppercase: { control: "boolean" },
    mono: { control: "boolean" },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SizeScale: Story = {
  render: () => (
    <div className="space-y-3">
      {(Object.keys(TEXT_SIZE) as Array<keyof typeof TEXT_SIZE>).map((size) => (
        <div key={size} className="flex items-baseline gap-4">
          <Text as="code" size="2xs" color="subtle" mono>
            {size}
          </Text>
          <Text size={size} color="primary">
            The quick brown fox jumps over the lazy dog
          </Text>
        </div>
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: () => (
    <div className="space-y-2">
      {(Object.keys(TEXT_COLOR) as Array<keyof typeof TEXT_COLOR>).map((color) => (
        <Text key={color} size="sm" color={color}>
          text-{color} - semantic copy at sm size
        </Text>
      ))}
    </div>
  ),
};

export const Weights: Story = {
  render: () => (
    <div className="space-y-2">
      {(Object.keys(FONT_WEIGHT) as Array<keyof typeof FONT_WEIGHT>).map((weight) => (
        <Text key={weight} size="base" weight={weight}>
          font-{weight}
        </Text>
      ))}
    </div>
  ),
};

export const LeadingScale: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      {(Object.keys(LEADING) as Array<keyof typeof LEADING>).map((leading) => (
        <div key={leading} className="border border-slate-200 rounded-xs p-2">
          <Text as="span" size="2xs" color="subtle" mono>
            leading-token-{leading}
          </Text>
          <Text size="base" leading={leading}>
            Multi-line leading sample. Line heights sit on a 4px grid so baselines align with layout rhythm.
          </Text>
        </div>
      ))}
    </div>
  ),
};

export const Presets: Story = {
  render: () => (
    <div className="w-80 space-y-4 rounded-xs bg-white p-4 shadow-soft">
      <Text as="span" size="2xs" color="subtle" weight="semibold" tracking="widest" uppercase>
        Quick actions
      </Text>
      <Text size="sm" color="secondary">Row title - default</Text>
      <Text size="sm" color="brand" weight="medium">Row title - active</Text>
      <Text size="xs" color="subtle">Row subtitle / metadata</Text>
      <Text size="sm" color="secondary" weight="medium" leading="none">Field label</Text>
      <Text size="xs" color="subtle">Field hint copy</Text>
        <Text size="2xs" color="subtle" mono>
        <Text as="kbd" size="2xs" color="inherit" mono>⌘K</Text> keyboard hint
      </Text>
    </div>
  ),
};
