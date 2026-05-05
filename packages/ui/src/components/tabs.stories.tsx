import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Tab layout direction.",
    },
    defaultValue: {
      control: "text",
      description: "Initially selected tab value.",
    },
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: "overview", orientation: "horizontal" },
  render: (args) => (
    <Tabs {...args} className="max-w-md">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Trace details and metadata.</TabsContent>
      <TabsContent value="photos">Imported and suggested photos.</TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="one" className="max-w-md">
      <TabsList variant="line">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Line tab content one.</TabsContent>
      <TabsContent value="two">Line tab content two.</TabsContent>
    </Tabs>
  ),
};
