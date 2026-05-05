import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const brandPkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(brandPkgRoot, "..", "..");

const configPath = path.join(brandPkgRoot, "app-assets.config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

const logoSourcePath = path.join(brandPkgRoot, "icon.svg");
const logoSvg = await fs.readFile(logoSourcePath, "utf8");

const faviconOutputPath = path.join(repoRoot, "apps", "web", "public", "favicon.svg");
const iconsOutputPath = path.join(repoRoot, "apps", "web", "public", "icons.svg");

await fs.writeFile(faviconOutputPath, logoSvg);
await fs.writeFile(iconsOutputPath, logoSvg);

const manifestOutputPath = path.join(repoRoot, "apps", "web", "public", "site.webmanifest");

const manifest = {
  name: config.web.name,
  short_name: config.web.shortName,
  description: config.web.description,
  theme_color: config.web.themeColor,
  background_color: config.web.backgroundColor,
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
};

await fs.writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);

const indexHtmlPath = path.join(repoRoot, "apps", "web", "index.html");
const indexHtml = await fs.readFile(indexHtmlPath, "utf8");
const themeMetaRegex = /<meta name="theme-color" content="[^"]*"\s*\/>/;
if (!themeMetaRegex.test(indexHtml)) {
  throw new Error(
    "Failed to update theme-color meta tag in apps/web/index.html (pattern not found).",
  );
}

const nextIndexHtml = indexHtml.replace(
  themeMetaRegex,
  `<meta name="theme-color" content="${config.web.themeColor}" />`,
);

await fs.writeFile(indexHtmlPath, nextIndexHtml);

console.log("Generated web assets (favicon/icons/manifest/theme-color).");
