import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";
import { Label } from "./label";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean", description: "Controlled checked state." },
    disabled: { control: "boolean", description: "Disables user interaction." },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultChecked: true },
  render: (args) => (
    <Label className="gap-2">
      <Checkbox {...args} />
      Receive photo import notifications
    </Label>
  ),
};

export const Controlled: Story = {
  render: () => {
    const [checked, setChecked] = useState(false);
    return (
      <Label className="gap-2">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        {checked ? "Enabled" : "Disabled"}
      </Label>
    );
  },
};
