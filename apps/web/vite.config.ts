import fs from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

const repoRoot = path.resolve(__dirname, "../..");
const appAssetsConfig = JSON.parse(
  fs.readFileSync(path.resolve(repoRoot, "packages", "brand", "app-assets.config.json"), "utf8"),
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons.svg"],
      manifest: {
        name: appAssetsConfig.web.name,
        short_name: appAssetsConfig.web.shortName,
        description: appAssetsConfig.web.description,
        theme_color: appAssetsConfig.web.themeColor,
        background_color: appAssetsConfig.web.backgroundColor,
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icons.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "style" ||
              request.destination === "image" ||
              request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 128,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // npm hoists workspace packages to the repo root; Vite’s root is apps/web only.
      "@curolia/plugin-contract": path.resolve(
        repoRoot,
        "packages/plugin-contract/src/index.ts",
      ),
      "@curolia/plugin-google-photos": path.resolve(
        repoRoot,
        "packages/plugins/google-photos/src/index.ts",
      ),
      "@curolia/plugin-ical": path.resolve(
        repoRoot,
        "packages/plugins/ical/src/index.ts",
      ),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
