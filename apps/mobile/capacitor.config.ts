import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.curolia.app",
  appName: "Curolia",
  webDir: "../web/dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
