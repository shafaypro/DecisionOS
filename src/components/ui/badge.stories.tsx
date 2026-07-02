import type { Meta, StoryObj } from "@storybook/nextjs";
import { Network, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge, Dot } from "./badge";
import { InlineReviewButtons } from "@/components/reviews/inline-review-buttons";
import {
  STATUS_COLORS, OUTCOME_COLORS, IMPACT_COLORS, CATEGORY_COLORS,
  STATUSES, OUTCOME_STATUSES, IMPACT_LEVELS, CATEGORIES, getLabelForValue, blastRadiusTone, memoryScoreTone, cn,
} from "@/lib/utils";
import { HEALTH_META } from "@/lib/decision-health";

const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "Badge" },
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "outline"] },
    href: { control: "text" },
    title: { control: "text" },
    // icon is a ReactNode - a text/object control feeds React `{}` and crashes.
    // Map named options to real nodes so the control can actually add an icon.
    icon: {
      control: "select",
      options: ["none", "network", "dot"],
      mapping: {
        none: undefined,
        network: <Network className="h-3 w-3" />,
        dot: <Dot className="bg-emerald-500" />,
      },
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">{children}</div>
);

// --- Primitives / configuration knobs ---
export const Playground: Story = { args: { variant: "default" } };

export const Variants: Story = {
  render: () => (
    <Row>
      <Badge variant="default">Default</Badge>
      <Badge variant="outline">Outline</Badge>
    </Row>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <Row>
      <Badge icon={<Network className="h-3 w-3" />}>Lucide icon</Badge>
      <Badge icon={<Dot className="bg-emerald-500" />}>Dot icon</Badge>
    </Row>
  )
};

export const AsLink: Story = {
  render: () => (
    <Badge href="#relations" icon={<Network className="h-3 w-3" />}>
      Links somewhere
    </Badge>
  ),
};

export const AsButton: Story = {
  render: () => (
    <Badge
      onClick={() => undefined}
      className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
      icon={<CheckCircle2 className="h-3 w-3" />}
    >
      Clickable badge
    </Badge>
  ),
};

// --- Real use cases (configured inline, exactly like the product) ---
export const StatusUseCase: Story = {
  render: () => (
    <Row>
      {STATUSES.map((s) => (
        <Badge key={s.value} className={STATUS_COLORS[s.value]}>
          {getLabelForValue(STATUSES, s.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const OutcomeUseCase: Story = {
  render: () => (
    <Row>
      {OUTCOME_STATUSES.map((o) => (
        <Badge key={o.value} className={OUTCOME_COLORS[o.value]}>
          {getLabelForValue(OUTCOME_STATUSES, o.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const ImpactUseCase: Story = {
  render: () => (
    <Row>
      {IMPACT_LEVELS.map((i) => (
        <Badge key={i.value} className={IMPACT_COLORS[i.value]}>
          {getLabelForValue(IMPACT_LEVELS, i.value)} Impact
        </Badge>
      ))}
    </Row>
  ),
};

export const CategoryUseCase: Story = {
  render: () => (
    <Row>
      {CATEGORIES.map((c) => (
        <Badge key={c.value} className={CATEGORY_COLORS[c.value]}>
          {getLabelForValue(CATEGORIES, c.value)}
        </Badge>
      ))}
    </Row>
  ),
};

export const HealthUseCase: Story = {
  render: () => (
    <Row>
      {Object.entries(HEALTH_META).map(([key, m]) => (
        <Badge key={key} className={m.tone} title={m.hint} icon={<Dot className={m.dot} />}>
          {m.label}
        </Badge>
      ))}
    </Row>
  ),
};

export const MemoryScoreUseCase: Story = {
  render: () => (
    <Row>
      {[20, 50, 85].map((n) => (
        <Badge key={n} className={memoryScoreTone(n)}>
          {n}% retrieval ready
        </Badge>
      ))}
    </Row>
  ),
};

export const BlastRadiusUseCase: Story = {
  render: () => (
    <Row>
      {[1, 3, 7].map((n) => (
        <Badge key={n} href="#relations" className={blastRadiusTone(n)} icon={<Network className="h-3 w-3" />}>
          Blast radius: {n}
        </Badge>
      ))}
    </Row>
  ),
};

export const ReviewActionUseCase: Story = {
  render: () => (
    <div className="space-y-3">
      <Row>
        <Badge
          className={cn(OUTCOME_COLORS.successful, "hover:bg-green-100")}
          icon={<CheckCircle2 className="h-3 w-3" />}
        >
          Still valid
        </Badge>
        <Badge
          className={cn(OUTCOME_COLORS.mixed, "hover:bg-amber-100")}
          icon={<AlertTriangle className="h-3 w-3" />}
        >
          Assumptions changed
        </Badge>
        <Badge className={cn(OUTCOME_COLORS.unsuccessful, "hover:bg-red-100")}>
          Didn&apos;t hold up
        </Badge>
      </Row>
      <Row>
        <Badge className={OUTCOME_COLORS.successful} icon={<CheckCircle2 className="h-3 w-3" />}>
          Marked as still valid
        </Badge>
        <Badge className={OUTCOME_COLORS.mixed} icon={<AlertTriangle className="h-3 w-3" />}>
          Marked as assumptions changed
        </Badge>
      </Row>
    </div>
  ),
};

export const InlineReviewUseCase: Story = {
  render: () => <InlineReviewButtons decisionId="demo-decision" />,
  parameters: { layout: "padded", backgrounds: { default: "white" } },
};
