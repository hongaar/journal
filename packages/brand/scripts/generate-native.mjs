import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const brandPkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(brandPkgRoot, "..", "..");
const mobileRoot = path.join(repoRoot, "apps", "mobile");

const configPath = path.join(brandPkgRoot, "app-assets.config.json");
const config = JSON.parse(await fs.readFile(configPath, "utf8"));

const logoSourcePath = path.join(brandPkgRoot, "icon.svg");
const logoSvg = await fs.readFile(logoSourcePath, "utf8");

const assetInputDirRel = ".asset-input";
const assetInputDir = path.join(mobileRoot, assetInputDirRel);
await fs.rm(assetInputDir, { recursive: true, force: true });
await fs.mkdir(assetInputDir, { recursive: true });

await fs.writeFile(path.join(assetInputDir, "icon.svg"), logoSvg);
await fs.writeFile(path.join(assetInputDir, "icon-dark.svg"), logoSvg);

const capacitorAssetsBin = path.join(repoRoot, "node_modules", ".bin", "capacitor-assets");

const args = [
  "generate",
  "--ios",
  "--android",
  "--assetPath",
  assetInputDirRel,
  "--androidProject",
  "android",
  "--iosProject",
  "ios/App",
  "--iconBackgroundColor",
  config.native.iconBackgroundColor,
  "--iconBackgroundColorDark",
  config.native.iconBackgroundColorDark,
  "--splashBackgroundColor",
  config.native.splashBackgroundColor,
  "--splashBackgroundColorDark",
  config.native.splashBackgroundColorDark,
  "--logoSplashScale",
  String(config.native.logoSplashScale ?? 0.2),
];

execFileSync(capacitorAssetsBin, args, { stdio: "inherit", cwd: mobileRoot });
console.log("Generated native assets via @capacitor/assets (iOS + Android).");
