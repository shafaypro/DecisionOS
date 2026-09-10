import type { Meta, StoryObj } from "@storybook/nextjs";
import { QualityMeter } from "./quality-meter";

const prose = (label: string) => `${label} `.repeat(20).trim();

const meta = {
  title: "Decisions/QualityMeter",
  component: QualityMeter,
  parameters: {
    docs: {
      description: {
        component:
          "Scores how well a decision is written down - the complement to the " +
          "health badge, which scores whether it is being maintained. Unmet " +
          "criteria are listed worst-first so the top hint is the highest-value fix.",
      },
    },
  },
  args: {
    decision: {
      summary: prose("summary"),
      problemStatement: prose("problem"),
      chosenOption: prose("chosen"),
      rationale: prose("rationale"),
      alternativesConsidered: prose("alternatives"),
      assumptions: prose("assumptions"),
      risks: prose("risks"),
      ownerUserId: "u1",
      reviewDate: new Date("2026-06-01"),
      linkCount: 2,
      tagCount: 1,
    },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QualityMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Excellent: Story = {};

export const Good: Story = {
  args: {
    decision: {
      summary: prose("summary"),
      problemStatement: prose("problem"),
      chosenOption: prose("chosen"),
      rationale: prose("rationale"),
      ownerUserId: "u1",
      reviewDate: new Date("2026-06-01"),
    },
  },
};

export const Thin: Story = {
  args: {
    decision: {
      chosenOption: prose("chosen"),
      rationale: prose("rationale"),
      ownerUserId: "u1",
    },
  },
};

export const TitleOnly: Story = {
  name: "Title only (poor)",
  args: { decision: {} },
};

export const StubFieldsEarnHalfCredit: Story = {
  name: "Stub fields earn half credit",
  args: { decision: { rationale: "because", alternativesConsidered: "n/a", ownerUserId: "u1" } },
};
