import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

function expectSelectorExcludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(!match[1].includes(snippet), `Expected selector ${selector} to exclude: ${snippet}`);
  }
}

const tabbarSource = readFile("./TabBar.vue");

expectSelectorIncludes(tabbarSource, ".tabbar__font-icon", ["color: var(--color-text);"]);
expectSelectorExcludes(tabbarSource, ".tabbar__font-icon", ["color: var(--color-text-tertiary);"]);
expectSelectorIncludes(tabbarSource, ".tabbar__label", ["color: var(--color-text);"]);
expectSelectorIncludes(tabbarSource, ".tabbar__item--active .tabbar__label", ["color: var(--color-icon-active);"]);
expectSelectorIncludes(tabbarSource, ".tabbar__item--active .tabbar__font-icon", ["color: var(--color-icon-active);"]);

console.log("tabbar style tests passed");
