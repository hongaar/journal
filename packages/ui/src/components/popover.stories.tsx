import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "./popover";

const meta = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Floating content anchored to a trigger. Positioning props are on `PopoverContent`.",
      },
    },
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger>
      <PopoverContent side="bottom" align="start">
        <PopoverHeader>
          <PopoverTitle>Trace actions</PopoverTitle>
          <PopoverDescription>Quick actions for this trace.</PopoverDescription>
        </PopoverHeader>
        <Button size="sm">Import photos</Button>
      </PopoverContent>
    </Popover>
  ),
};
