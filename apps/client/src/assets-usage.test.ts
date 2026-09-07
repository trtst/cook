import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";

const clientSrcDir = resolve(__dirname);
const assetsDir = join(clientSrcDir, "assets");

function walk(dir: string) {
  const items: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      items.push(...walk(path));
    } else {
      items.push(path);
    }
  }
  return items;
}

const sourceFiles = walk(clientSrcDir).filter(path => {
  if (path.includes("/assets/")) return false;
  if (path.endsWith("assets-usage.test.ts")) return false;
  return /\.(vue|ts|tsx|js|jsx|scss|css|json)$/u.test(path);
});

const sourceTexts = sourceFiles.map(path => ({
  path: relative(clientSrcDir, path),
  text: readFileSync(path, "utf8")
}));

function realReferences(assetPath: string) {
  const assetRelativePath = relative(clientSrcDir, assetPath).replace(/\\/gu, "/");
  const assetPathWithoutRoot = assetRelativePath.replace(/^assets\//u, "");
  const fileName = basename(assetPath);

  return sourceTexts
    .filter(item => {
      if (/\.(test|spec)\.[cm]?[jt]sx?$/u.test(item.path)) return false;
      return item.text.includes(assetRelativePath) || item.text.includes(assetPathWithoutRoot) || item.text.includes(fileName);
    })
    .map(item => item.path);
}

const assetFiles = walk(assetsDir).filter(path => /\.(png|jpe?g|gif|webp|svg)$/iu.test(path));

const unusedAssets = assetFiles
  .map(path => ({ path: relative(clientSrcDir, path).replace(/\\/gu, "/"), refs: realReferences(path) }))
  .filter(item => item.refs.length === 0)
  .map(item => item.path);

assert.deepEqual(unusedAssets, []);

for (const pagePath of [
  "pages/recipe/index.vue",
  "pages_me/ingredient-units/index.vue",
  "pages_me/recommend-detail/index.vue",
  "pages_me/taste/index.vue",
  "pages_meal/event/index.vue",
  "pages_meal/plan/index.vue",
  "pages_pantry/index/index.vue",
  "pages_pantry/list/index.vue",
  "pages_pantry/list-detail/index.vue",
  "pages_recipe/edit/index.vue",
  "pages_recipe/list/index.vue"
]) {
  const source = readFileSync(join(clientSrcDir, pagePath), "utf8");
  assert.ok(source.includes('from "@/assets/empty.png"'), `${pagePath} should use the shared empty image`);
}

const recipePageSource = readFileSync(join(clientSrcDir, "pages/recipe/index.vue"), "utf8");
assert.ok(recipePageSource.includes("cookfont icon-manage manage-fab__icon"));
assert.ok(!recipePageSource.includes("manageIcon"));

console.log("asset usage tests passed");
