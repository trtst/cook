import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

const sharedStylePath = resolve(__dirname, "./nav-tabs.scss");
const sharedStyle = existsSync(sharedStylePath) ? readFileSync(sharedStylePath, "utf8") : "";
const appSource = readFile("../App.vue");
const pageSources = [
  readFile("../pages_meal/event/index.vue"),
  readFile("../pages_pantry/list/index.vue"),
  readFile("../pages_me/ingredient-units/index.vue"),
  readFile("../pages/recipe/index.vue"),
  readFile("../pages_recipe/detail/index.vue")
];

assert.ok(appSource.includes('@use "@/styles/nav-tabs.scss";'), "Expected App to load shared Navbar tab styles");

for (const snippet of [
  ".nav-tab-active-indicator::after {",
  "left: 50%;",
  "right: auto;",
  "width: 120%;",
  "transform-origin: center;",
  "animation: nav-tab-active-expand 220ms ease-out both;",
  "transform: translateX(-50%) scaleX(0) rotate(-5deg);",
  "transform: translateX(-50%) scaleX(1) rotate(-5deg);"
]) {
  assert.ok(sharedStyle.includes(snippet), `Expected shared Navbar tab style: ${snippet}`);
}

for (const source of pageSources) {
  assert.ok(source.includes("nav-tab-active-indicator"), "Expected each target page to use the shared active indicator");
  assert.ok(!source.includes(".nav-tabs__item--active::after"), "Expected page-local nav tab underline styles to be removed");
  assert.ok(!source.includes(".detail-nav-tabs__item--active::after"), "Expected page-local detail tab underline styles to be removed");
  assert.ok(!source.includes("@keyframes nav-tab-active-expand"), "Expected the shared animation keyframes to live in one global file");
}

console.log("shared Navbar tab indicator tests passed");
