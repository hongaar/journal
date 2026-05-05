import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "UI/Dropdown Menu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Menu primitives with support for submenus, checkbox items, radio groups, and destructive variants.",
      },
    },
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [showImported, setShowImported] = useState(true);
    const [sortBy, setSortBy] = useState("date");

    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          Open menu
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Trace actions</DropdownMenuLabel>
          <DropdownMenuItem>
            Edit trace
            <DropdownMenuShortcut>E</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            Delete trace
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={showImported}
            onCheckedChange={setShowImported}
          >
            Show imported photos
          </DropdownMenuCheckboxItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sort by</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="distance">
                  Distance
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};
