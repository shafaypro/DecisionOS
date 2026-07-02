import type { Meta, StoryObj } from "@storybook/nextjs";
import { CommandPalette } from "./command-palette";

/**
 * Global ⌘K / Ctrl+K search. Renders nothing until opened; the Open story's
 * play function fires the shortcut. Search hits /api/decisions/search - the
 * WithResults story seeds matches via parameters.mockData.
 */
const meta = {
  title: "Search/CommandPalette",
  component: CommandPalette,
  parameters: { layout: "fullscreen", nextjs: { navigation: { pathname: "/decisions" } } },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  },
};

export const WithResults: Story = {
  parameters: {
    mockData: {
      "/api/decisions/search": {
        decisions: [
          { id: "d1", title: "Migrate to Postgres", status: "approved", category: "engineering" },
          { id: "d2", title: "Adopt feature flags", status: "approved", category: "engineering" },
        ],
      },
    },
  },
  play: async () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  },
};
