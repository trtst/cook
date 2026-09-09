import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "index.vue"), "utf8");
const configSource = readFileSync(join(currentDir, "../../config/env.ts"), "utf8");
const clientSrcDir = join(currentDir, "../..");
const heroCopyClass = "hero-banner__copy";

assert.equal(source.includes("@/assets/home-actions/"), false);
assert.equal(source.includes(`${heroCopyClass}--hero-`), false);
assert.equal(source.includes("https://static.trtst.com/dev/"), false);
assert.equal(source.includes("https://static.trtst.com/O/"), false);
assert.equal(source.includes("/static/0/uploads/"), false);
assert.match(configSource, /VITE_ASSET_PUBLIC_BASE_URL/);
assert.match(configSource, /assetPublicBaseUrl: .*import\.meta\.env\.VITE_ASSET_PUBLIC_BASE_URL/);
assert.match(source, /const heroAssetBase = `\$\{cfg\.assetPublicBaseUrl\}\/uploads\/material-store`/);
assert.match(source, /const heroImagePrimary = `\$\{heroAssetBase\}\/3a0414c9-7f44-444c-93fe-873c226c8166\.png\?v=2026-09-05T15%3A51%3A22\.009Z`/);
assert.match(source, /const heroImageSecondary = `\$\{heroAssetBase\}\/5a7629a0-c9f7-4075-b36e-5716cee073ba\.png\?v=2026-09-05T15%3A51%3A32\.022Z`/);
assert.match(source, /imageUrl: heroImagePrimary/);
assert.match(source, /imageUrl: heroImageSecondary/);
assert.equal(existsSync(join(clientSrcDir, "assets/home-actions")), false);
