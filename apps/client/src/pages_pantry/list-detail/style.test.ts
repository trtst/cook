import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function selectorBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...source.matchAll(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "gm"))];
  const body = matches[matches.length - 1]?.[1];
  assert.ok(body, `Expected selector to exist: ${selector}`);
  return body;
}

assert.match(
  source,
  /class="store-card__head"[\s\S]*?class="store-card__title"[\s\S]*?class="store-card__button[\s\S]*?class="store-card__detail"[\s\S]*?class="store-card__desc"/,
  "Store cards should render the title and button in the first row, with the description in the row below"
);

const storeRows = selectorBody(".store-card__head,\n.store-card__detail");
assert.match(storeRows, /display:\s*flex;/, "Store-card rows should use a horizontal layout");
assert.match(storeRows, /justify-content:\s*space-between;/, "Store-card row contents should align to opposite sides");

const storeHead = selectorBody(".store-card__head");
assert.match(storeHead, /align-items:\s*center;/, "Store-card titles and buttons should align within the same row");

const storeDetail = selectorBody(".store-card__detail");
assert.match(storeDetail, /margin-top:\s*18rpx;/, "Store-card descriptions should sit below the title row");

console.log("pantry list-detail style tests passed");
