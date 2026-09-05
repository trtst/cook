/**
 * 小程序分包边界静态检查。
 *
 * 这组检查只锁定“分包私有代码不能落到主包根目录”的工程约束，
 * 防止微信开发者工具继续提示主包存在未被主包使用的 JS 文件。
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const clientRoot = resolve(__dirname, "..");
const sourceRoot = resolve(__dirname);

const forbiddenMainFiles = [
  "apis/knowledge.js",
  "composables/useImageCropFlow.js",
  "services/subscribe-message.js",
  "utils/image-crop.js",
  "utils/shopping.js"
];

const forbiddenSourceImports = [
  "@/apis/knowledge",
  "@/composables/useImageCropFlow",
  "@/services/subscribe-message",
  "@/utils/image-crop",
  "@/utils/shopping"
];

const sourceFiles = [
  "pages_me/knowledge-list/index.vue",
  "pages_me/knowledge-detail/index.vue",
  "pages_me/composables/useImageCropFlow.ts",
  "pages_me/profile/index.vue",
  "pages_recipe/composables/useImageCropFlow.ts",
  "pages_recipe/crop/index.vue",
  "pages_recipe/edit/index.vue",
  "pages_pantry/index/index.vue",
  "pages_pantry/list/index.vue",
  "pages_pantry/gap/index.vue",
  "pages_recipe/detail/index.vue",
  "pages_meal/detail/index.vue",
  "pages_meal/plan/index.vue"
];

for (const sourceFile of sourceFiles) {
  const source = readFileSync(join(sourceRoot, sourceFile), "utf8");
  for (const importPath of forbiddenSourceImports) {
    assert.ok(
      !source.includes(importPath),
      `${sourceFile} must not import ${importPath}; subpackage-only code should stay inside its owning subpackage`
    );
  }
}

for (const mode of ["dev", "build"]) {
  const outputRoot = join(clientRoot, "dist", mode, "mp-weixin");
  if (!existsSync(outputRoot)) continue;
  for (const outputFile of forbiddenMainFiles) {
    const fullPath = join(outputRoot, outputFile);
    assert.ok(
      !existsSync(fullPath),
      `${relative(clientRoot, fullPath)} must not be emitted into the main package`
    );
  }
}

console.log("mp-weixin package boundary tests passed");
