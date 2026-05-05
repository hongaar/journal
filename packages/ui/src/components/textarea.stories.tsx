import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text", description: "Placeholder text." },
    rows: { control: "number", description: "Visible row count." },
    disabled: { control: "boolean", description: "Disables textarea." },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Write a trace description...", rows: 4 },
};
