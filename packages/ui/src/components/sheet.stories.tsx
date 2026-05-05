import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

const meta = {
  title: "UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Side/top/bottom drawer component. `side` and `showCloseButton` are set on `SheetContent`.",
      },
    },
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Trace settings</SheetTitle>
          <SheetDescription>Configure options for this trace.</SheetDescription>
        </SheetHeader>
        <div className="px-4 text-sm">Additional content area.</div>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open bottom sheet</SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Mobile actions</SheetTitle>
          <SheetDescription>Designed for short action lists.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
