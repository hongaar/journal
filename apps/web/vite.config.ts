import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // npm hoists workspace packages to the repo root; Vite’s root is apps/web only.
      "@curolia/connector-contract": path.resolve(repoRoot, "packages/connector-contract/src/index.ts"),
      "@curolia/connector-ical": path.resolve(repoRoot, "packages/connectors/ical/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
