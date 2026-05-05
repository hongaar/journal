import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Card spacing preset.",
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { size: "default" },
  render: (args) => (
    <Card {...args} className="max-w-md">
      <CardHeader>
        <CardTitle>Trip to Kyoto</CardTitle>
        <CardDescription>
          Trace and photo summary for this stop.
        </CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        Visited Fushimi Inari around sunset and imported 8 photos.
      </CardContent>
      <CardFooter>Updated 2 hours ago</CardFooter>
    </Card>
  ),
};

export const Small: Story = {
  args: { size: "sm" },
  render: Default.render,
};
