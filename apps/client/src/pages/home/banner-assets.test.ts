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
assert.match(source, /const heroAssetBase = `\$\{cfg\.domain\}\/static\/uploads\/material-store`/);
assert.match(source, /const heroImagePrimary = `\$\{heroAssetBase\}\/e499ecd9-4821-44ee-ab05-db2124e759e0\.png\?v=2026-09-05T11%3A50%3A52\.021Z`/);
assert.match(source, /const heroImageSecondary = `\$\{heroAssetBase\}\/bffc3b08-a6c0-4a4f-91a4-96fc9a242751\.png\?v=2026-09-05T11%3A51%3A08\.293Z`/);
assert.match(source, /imageUrl: heroImagePrimary/);
assert.match(source, /imageUrl: heroImageSecondary/);
assert.deepEqual(homeActionFiles.filter(fileName => fileName.endsWith(".png")), []);
