import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: { control: "text", description: "Native input type." },
    placeholder: { control: "text", description: "Placeholder text." },
    disabled: { control: "boolean", description: "Disables input." },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Text: Story = {
  args: { type: "text", placeholder: "Trace title" },
};

export const Disabled: Story = {
  args: { placeholder: "Cannot edit", disabled: true },
};
