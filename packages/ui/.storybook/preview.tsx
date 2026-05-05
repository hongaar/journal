import type { Preview } from "@storybook/react";
import { ThemeProvider } from "next-themes";
import "../../../apps/web/src/index.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
      >
        <div className="bg-background text-foreground min-h-[120px] p-4">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default preview;
