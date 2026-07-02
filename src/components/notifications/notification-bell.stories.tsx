import type { Meta, StoryObj } from "@storybook/nextjs";
import { NotificationBell } from "./notification-bell";

/**
 * Fetches /api/notifications on mount. The preview stub returns an empty list;
 * the WithUnread story overrides it via parameters.mockData. Click the bell to
 * open the panel.
 */
const meta = {
  title: "Notifications/NotificationBell",
  component: NotificationBell,
  parameters: { backgrounds: { default: "ink" } },
} satisfies Meta<typeof NotificationBell>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleNotifications = {
  unreadCount: 2,
  notifications: [
    {
      id: "n1",
      type: "review_due",
      title: "Review due: Migrate to Postgres",
      body: "This decision is due for review.",
      isRead: false,
      createdAt: new Date().toISOString(),
      decisionId: "d1",
    },
    {
      id: "n2",
      type: "mention",
      title: "Grace mentioned you",
      body: "On 'Adopt feature flags'.",
      isRead: false,
      createdAt: new Date().toISOString(),
      decisionId: "d2",
    },
  ],
};

export const Default: Story = {};

export const WithUnread: Story = {
  parameters: {
    mockData: { "/api/notifications": sampleNotifications },
  },
};
