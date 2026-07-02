import type { Meta, StoryObj } from "@storybook/nextjs";
import { File, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Row } from "./row";

type Args = React.ComponentProps<typeof Row> & {
  leadingKind?: "none" | "icon" | "checkbox" | "radio";
  trailingKind?: "none" | "icon";
  bordered?: boolean;
  radius?: "none" | "sm" | "md" | "lg";
};

const radiusClass = { none: "rounded-none", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg" };

function leadingFor(k: Args["leadingKind"]) {
  switch (k) {
    case "icon": return <File className="h-4 w-4 text-gray-500" />;
    case "checkbox": return <input type="checkbox" defaultChecked />;
    case "radio": return <input type="radio" name="demo" defaultChecked />;
    default: return null;
  }
}

const meta = {
  title: "UI/Row",
  component: Row,
  parameters: { layout: "padded" },
  args: {
    title: "Acme Corp", subtitle: "3 decisions", rightText: "2d ago",
    size: "sm", selected: false, disabled: false, hover: true,
    leadingKind: "icon", trailingKind: "none",
    bordered: false, radius: "none",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
    leadingKind: { control: "inline-radio", options: ["none", "icon", "checkbox", "radio"] },
    trailingKind: { control: "inline-radio", options: ["none", "icon"] },
    selected: { control: "boolean" },
    disabled: { control: "boolean" },
    hover: { control: "boolean" },
    bordered: { control: "boolean" },
    radius: { control: "inline-radio", options: ["none", "sm", "md", "lg"] },
  },
  render: ({ leadingKind, trailingKind, bordered, radius, ...args }: Args) => (
    <div className={cn("w-80", bordered && "border border-gray-200", radiusClass[radius ?? "none"])}>
      <Row
        {...args}
        leading={leadingFor(leadingKind)}
        trailing={trailingKind === "icon" ? <MoreHorizontal className="h-4 w-4 text-gray-400" /> : null}
      />
    </div>
  ),
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<typeof meta>;

// Fully configurable from the controls panel.
export const Playground: Story = {};

// Radio group = consumer maps over Row with a shared name. No wrapper component (yet).
export const RadioGroup: Story = {
  render: () => {
    const opts = [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
      { id: "c", name: "Carol" },
    ];
    return (
      <div className="w-80 divide-y divide-gray-100">
        {opts.map((o) => (
          <Row
            key={o.id}
            title={o.name}
            leading={<input type="radio" name="owner" value={o.id} defaultChecked={o.id === "a"} />}
          />
        ))}
      </div>
    );
  },
};
