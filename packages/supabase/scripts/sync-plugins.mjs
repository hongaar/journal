#!/usr/bin/env node
/**
 * Copies Edge Function folders from plugin packages into
 * `packages/supabase/supabase/functions/` so the Supabase CLI can serve and deploy them.
 *
 * Layout: packages/plugins/<id>/supabase/functions/<slug>/**
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabasePkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(supabasePkgRoot, "..", "..");
const pluginsRoot = path.join(repoRoot, "packages", "plugins");
const destRoot = path.join(supabasePkgRoot, "supabase", "functions");

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, name.name);
    const d = path.join(dest, name.name);
    if (name.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(pluginsRoot)) {
  console.warn("sync-plugins: no packages/plugins directory");
  process.exit(0);
}

let count = 0;
for (const pkg of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const fnRoot = path.join(pluginsRoot, pkg.name, "supabase", "functions");
  if (!fs.existsSync(fnRoot)) continue;

  for (const slug of fs.readdirSync(fnRoot, { withFileTypes: true })) {
    if (!slug.isDirectory()) continue;
    const src = path.join(fnRoot, slug.name);
    const dest = path.join(destRoot, slug.name);
    rmrf(dest);
    copyDir(src, dest);
    console.log(
      `synced ${path.relative(repoRoot, src)} -> ${path.relative(repoRoot, dest)}`,
    );
    count += 1;
  }
}

if (count === 0) console.log("sync-plugins: no plugin functions found");
else console.log(`sync-plugins: ${count} function(s) synced`);
