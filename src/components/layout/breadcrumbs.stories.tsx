import type { Meta, StoryObj } from "@storybook/nextjs";
import { Breadcrumbs } from "./breadcrumbs";

/**
 * Breadcrumbs derive from the current path via next/navigation usePathname.
 * Each story sets a different mocked pathname through
 * `parameters.nextjs.navigation.pathname`.
 */
const meta = {
  title: "Layout/Breadcrumbs",
  component: Breadcrumbs,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DecisionsList: Story = {
  parameters: { nextjs: { navigation: { pathname: "/decisions" } } },
};

export const Nested: Story = {
  parameters: { nextjs: { navigation: { pathname: "/decisions/new" } } },
};

export const Settings: Story = {
  parameters: { nextjs: { navigation: { pathname: "/settings/sso" } } },
};
