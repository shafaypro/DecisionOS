import type { Meta, StoryObj } from "@storybook/nextjs";
import { NoteReplies } from "./note-replies";

/**
 * Threaded replies under a decision note. The thread renders indented with a
 * left rule; the composer opens inline from the Reply button. Deleting is
 * offered on hover to the reply author (or an admin) only.
 */
const meta = {
  title: "Decisions/NoteReplies",
  component: NoteReplies,
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NoteReplies>;

export default meta;
type Story = StoryObj<typeof meta>;

const replies = [
  {
    id: "r1",
    content: "Nice - does replica lag stay acceptable during peak traffic?",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { id: "u-admin", name: "Alex Chen" },
  },
  {
    id: "r2",
    content: "Yes, load test showed ~200ms p99 lag. Full numbers are in the migration RFC.",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    user: { id: "u-sarah", name: "Sarah Kim" },
  },
];

/** Viewing as the author of the second reply - its delete appears on hover. */
export const Thread: Story = {
  args: {
    noteId: "note-1",
    replies,
    currentUserId: "u-sarah",
    isAdmin: false,
  },
};

/** No replies yet - only the Reply trigger shows; click it for the composer. */
export const EmptyComposer: Story = {
  args: {
    noteId: "note-1",
    replies: [],
    currentUserId: "u-sarah",
    isAdmin: false,
  },
};

/** Read-only (viewer role): the thread renders but there is no composer. */
export const ReadOnly: Story = {
  args: {
    noteId: "note-1",
    replies,
    currentUserId: "u-viewer",
    isAdmin: false,
    readOnly: true,
  },
};
