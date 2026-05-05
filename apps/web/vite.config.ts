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
      "@curolia/plugin-contract": path.resolve(repoRoot, "packages/plugin-contract/src/index.ts"),
      "@curolia/plugin-google-photos": path.resolve(repoRoot, "packages/plugins/google-photos/src/index.ts"),
      "@curolia/plugin-ical": path.resolve(repoRoot, "packages/plugins/ical/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
