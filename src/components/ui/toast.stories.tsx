import type { Meta, StoryObj } from "@storybook/nextjs";
import { ToastProvider, useToast } from "./toast";
import { Button } from "./button";

/**
 * Toasts render into a fixed viewport at the bottom-right. The global preview
 * decorator already wraps every story in <ToastProvider>; this demo triggers
 * toasts via the useToast() hook.
 */
function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => toast.success("Decision saved")}>Success</Button>
      <Button variant="destructive" onClick={() => toast.error("Failed to save")}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast.info("Review due in 3 days")}>
        Info
      </Button>
    </div>
  );
}

const meta = {
  title: "UI/Toast",
  component: ToastProvider,
  args: { children: null },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Triggers: Story = {
  render: () => <ToastDemo />,
};
