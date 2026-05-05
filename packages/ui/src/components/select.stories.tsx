import type { Meta, StoryObj } from "@storybook/react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./select";

const meta = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: { control: "text", description: "Initially selected item value." },
  },
  parameters: {
    docs: {
      description: {
        component: "Composed select primitives. Trigger supports `size`; content supports side/alignment positioning.",
      },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: "google_photos" },
  render: (args) => (
    <Select {...args}>
      <SelectTrigger size="default">
        <SelectValue placeholder="Choose plugin" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Media</SelectLabel>
          <SelectItem value="google_photos">Google Photos</SelectItem>
          <SelectItem value="immich">Immich</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Calendar</SelectLabel>
          <SelectItem value="ical">iCal feed</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
