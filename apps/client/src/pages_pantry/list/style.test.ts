import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function selectorBlock(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);
  return match[1];
}

const trackBlock = selectorBlock(".progress-block__track");
const valueBarBlock = selectorBlock(".progress-block__value-bar");

assert.ok(trackBlock.includes("background: var(--color-surface-muted);"), "Expected shopping progress track to use a plain light color.");
assert.ok(valueBarBlock.includes("background: var(--color-support-action);"), "Expected shopping progress bar to use a semantic action color.");
assert.ok(!valueBarBlock.includes("var(--button-primary-bg)"), "Expected shopping progress bar not to use the button gradient.");
assert.ok(!valueBarBlock.includes("linear-gradient"), "Expected shopping progress bar not to use a gradient.");

console.log("pantry list style tests passed");
