import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="approved">
      <SelectTrigger className="w-56">
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Status</SelectLabel>
          <SelectItem value="proposed">Proposed</SelectItem>
          <SelectItem value="in_review">In Review</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="reversed">Reversed</SelectItem>
          <SelectItem value="superseded">Superseded</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
