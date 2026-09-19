import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const layoutSource = readFileSync(resolve(__dirname, "Layout.vue"), "utf8");
const loadingSource = readFileSync(resolve(__dirname, "../PageLoading/PageLoading.vue"), "utf8");

assert.ok(layoutSource.includes("import PageLoading from \"@/components/PageLoading/PageLoading.vue\";"));
assert.ok(layoutSource.includes(":visible=\"pageLoading\""));
assert.ok(layoutSource.includes("pageLoading?: boolean;"));
assert.ok(loadingSource.includes("position: absolute;"));
assert.ok(loadingSource.includes("inset: 0;"));
assert.ok(loadingSource.includes("class=\"page-loading__loader\""));
assert.ok(loadingSource.includes(".page-loading__loader::before"));
assert.ok(loadingSource.includes(".page-loading__loader::after"));
assert.ok(loadingSource.includes("@keyframes page-loading-drink"));
assert.ok(loadingSource.includes("var(--color-primary)"));
assert.ok(loadingSource.includes("var(--color-surface-muted)"));

console.log("page loading contract passed");
