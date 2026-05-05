import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from "./emoji-picker";

const meta = {
  title: "UI/Emoji Picker",
  component: EmojiPicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Frimousse-based emoji picker wrapper. Use with search/content/footer composition.",
      },
    },
  },
} satisfies Meta<typeof EmojiPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("📍");
    return (
      <div className="space-y-2">
        <p className="text-sm">Selected: {value}</p>
        <div className="h-[320px]">
          <EmojiPicker onEmojiSelect={(emoji) => setValue(emoji.emoji)}>
            <EmojiPickerSearch placeholder="Find emoji..." />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </div>
      </div>
    );
  },
};
