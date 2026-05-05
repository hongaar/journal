import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta = {
  title: "UI/Sonner Toaster",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {
    richColors: {
      control: "boolean",
      description: "Enable rich toast colors.",
    },
    closeButton: {
      control: "boolean",
      description: "Show close button on toasts.",
    },
  },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { richColors: true, closeButton: true },
  render: (args) => (
    <div className="space-x-2">
      <Toaster {...args} />
      <Button onClick={() => toast.success("Plugin connected successfully.")}>
        Success
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Could not import selected photo.")}
      >
        Error
      </Button>
    </div>
  ),
};
