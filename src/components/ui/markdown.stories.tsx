import type { Meta, StoryObj } from "@storybook/nextjs";
import { Markdown } from "./markdown";

const meta = {
  title: "UI/Markdown",
  component: Markdown,
  parameters: {
    docs: {
      description: {
        component:
          "Renders user-authored Markdown from decision fields and notes. The " +
          "renderer escapes the entire input before emitting any tag, so only " +
          "tags it produces itself can appear in the output.",
      },
    },
  },
  args: { text: "A **decision** record with *emphasis* and `inline code`." },
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const FullDocument: Story = {
  args: {
    text: [
      "## Why we moved off Auth0",
      "",
      "Cost scaled with MAU and we could not self-host.",
      "",
      "- Keycloak: too much ops burden",
      "- Clerk: same lock-in, different vendor",
      "",
      "1. Ship JWT sessions",
      "2. Migrate users",
      "",
      "> We accept owning the security surface.",
      "",
      "See the [RFC](https://example.com/rfc) and `src/lib/session.ts`.",
      "",
      "```",
      "await getSession();",
      "```",
      "",
      "---",
      "",
      "~~Deferred:~~ SCIM provisioning.",
    ].join("\n"),
  },
};

export const UnsafeInputIsNeutralized: Story = {
  name: "Unsafe input is neutralized",
  args: {
    text: [
      "<script>alert('xss')</script>",
      "",
      "[looks like a link](javascript:alert(1))",
      "",
      "<img src=x onerror=alert(1)>",
    ].join("\n"),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Script tags render as literal text, and a `javascript:` link renders " +
          "as its label with no anchor at all.",
      },
    },
  },
};

export const Empty: Story = {
  args: { text: "" },
  parameters: {
    docs: { description: { story: "Empty input renders nothing - not an empty box." } },
  },
};
