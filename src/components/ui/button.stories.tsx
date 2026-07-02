import type { Meta, StoryObj } from "@storybook/nextjs";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { Button, type ButtonProps } from "./button";

const plus = <Plus className="h-4 w-4" />;
const arrow = <ArrowRight className="h-4 w-4" />;
const trash = <Trash2 className="h-4 w-4" />;

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;
const SIZES = ["sm", "md", "lg"] as const;

// icon-config columns rendered for every variant × size cell
const CONFIGS: { label: string; props: Partial<ButtonProps> }[] = [
  { label: "text", props: { children: "Button" } },
  { label: "icon+text", props: { icon: plus, children: "Button" } },
  { label: "text+icon", props: { iconRight: arrow, children: "Button" } },
  { label: "both", props: { icon: plus, iconRight: arrow, children: "Button" } },
  { label: "icon-only", props: { icon: trash, "aria-label": "Delete" } },
];

// Ghost: no background at rest, light-grey (slate-100) on hover. Same box as every other variant.
export const Ghost: Story = {
  args: { variant: "ghost" },
  render: (args) => (
    <div className="flex flex-col gap-3">
      {SIZES.map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3">
          <span className="w-16 text-xs text-slate-400">{size}</span>
          {CONFIGS.map((c) => (
            <Button key={c.label} {...args} size={size} {...c.props} />
          ))}
          <Button {...args} size={size} icon={plus} disabled>Disabled</Button>
        </div>
      ))}
    </div>
  ),
};

// Every button the design system produces, on one screen.
export const All: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {VARIANTS.map((variant) => (
        <section key={variant} className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{variant}</h3>
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <span className="w-16 text-xs text-slate-400">{size}</span>
              {CONFIGS.map((c) => (
                <Button key={c.label} variant={variant} size={size} {...c.props} />
              ))}
              <Button variant={variant} size={size} icon={plus} disabled>Disabled</Button>
            </div>
          ))}
        </section>
      ))}
    </div>
  ),
};
