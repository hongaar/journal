import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
  argTypes: {
    children: { control: "text", description: "Label content." },
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Trace title" },
  render: (args) => (
    <div className="grid gap-2 max-w-sm">
      <Label htmlFor="trace-title" {...args} />
      <Input id="trace-title" placeholder="Visited place" />
    </div>
  ),
};
