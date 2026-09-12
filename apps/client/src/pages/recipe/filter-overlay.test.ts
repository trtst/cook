import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const navbarSource = readFileSync(resolve(__dirname, "../../components/NavBar/NavBar.vue"), "utf8");
const tabbarSource = readFileSync(resolve(__dirname, "../../components/TabBar/TabBar.vue"), "utf8");

expectSelectorIncludes(source, ".recipe-head", [
  "z-index: 901;"
]);
expectSelectorIncludes(source, ".filter-overlay", [
  "position: fixed;",
  "z-index: 1;"
]);
expectSelectorIncludes(navbarSource, ".navbar__fixed", [
  "z-index: 800;"
]);
expectSelectorIncludes(tabbarSource, ".tabbar-shell", [
  "z-index: 900;"
]);

console.log("recipe filter overlay tests passed");
