import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "index.vue"), "utf8");
const clientSrcDir = join(currentDir, "../..");
const homeActionFiles = readdirSync(join(clientSrcDir, "assets/home-actions"));
const heroCopyClass = "hero-banner__copy";

assert.equal(source.includes("@/assets/home-actions/"), false);
assert.equal(source.includes(`${heroCopyClass}--hero-`), false);
assert.equal(source.includes("https://static.trtst.com/dev/"), false);
assert.equal(source.includes("https://static.trtst.com/O/"), false);
assert.equal(source.includes("/static/0/uploads/"), false);
assert.match(source, /const heroAssetBase = `\$\{cfg\.domain\}\/static\/uploads\/material-store`/);
assert.match(source, /const heroImagePrimary = `\$\{heroAssetBase\}\/3a0414c9-7f44-444c-93fe-873c226c8166\.png\?v=2026-09-05T15%3A51%3A22\.009Z`/);
assert.match(source, /const heroImageSecondary = `\$\{heroAssetBase\}\/5a7629a0-c9f7-4075-b36e-5716cee073ba\.png\?v=2026-09-05T15%3A51%3A32\.022Z`/);
assert.match(source, /imageUrl: heroImagePrimary/);
assert.match(source, /imageUrl: heroImageSecondary/);
assert.deepEqual(homeActionFiles.filter(fileName => fileName.endsWith(".png")), []);
