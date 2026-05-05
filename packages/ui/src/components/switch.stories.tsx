import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Switch } from "./switch";

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Switch size variant.",
    },
    checked: { control: "boolean", description: "Controlled checked state." },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultChecked: true, size: "default" },
};

export const Controlled: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false);
    return (
      <Label className="gap-3">
        <Switch checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
        {enabled ? "Enabled" : "Disabled"}
      </Label>
    );
  },
};
