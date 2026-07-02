import type { Meta, StoryObj } from "@storybook/nextjs";
import { ShortcutsOverlay } from "./shortcuts-overlay";

/**
 * Global keyboard cheatsheet. It renders nothing until the user presses "?".
 * The play function fires that key so the overlay is visible on load; press
 * "?" again or Esc to toggle.
 */
const meta = {
  title: "Overlays/ShortcutsOverlay",
  component: ShortcutsOverlay,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ShortcutsOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
  },
};

export const ClosedUntilKey: Story = {};
