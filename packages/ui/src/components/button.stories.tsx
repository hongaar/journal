import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
      description: "Visual button style.",
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
      description: "Button sizing token.",
    },
    children: {
      control: "text",
      description: "Button label/content.",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
    size: "default",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">LG</Button>
      <Button size="icon" aria-label="Icon">
        +
      </Button>
      <Button size="icon-sm" aria-label="Icon small">
        +
      </Button>
    </div>
  ),
};
