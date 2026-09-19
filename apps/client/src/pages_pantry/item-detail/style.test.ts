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

assert.ok(!source.includes('<scroll-view scroll-y class="detail-scroll">'), "The page should not use a full-page scrolling container");
assert.match(source, /<scroll-view[\s\S]*class="detail-content-scroll"/, "Long details should remain accessible in the fixed content area");
assert.ok(!source.includes('class="detail-hero__avatar"'), "The ingredient image should not be rendered as an avatar");
assert.ok(source.includes('class="detail-hero__cover"'), "The ingredient image should use the recipe-detail cover structure");
assert.match(
  source,
  /<view[^>]*class="detail-hero"[^>]*>[\s\S]*class="detail-hero__cover"[\s\S]*class="summary-card"[\s\S]*<\/view>\s*<\/view>\s*<scroll-view/,
  "The summary card should float inside the cover instead of moving below the image"
);

const page = selectorBody(".detail-page");
assert.match(page, /display:\s*flex;/, "The detail page should use a fixed flex layout");
assert.match(page, /height:\s*100%;/, "The detail page should fill the fixed viewport");
assert.match(page, /overflow:\s*hidden;/, "The detail page should not expose page-level scrolling");

const cover = selectorBody(".detail-hero__cover");
assert.match(cover, /padding-top:\s*100%;/, "The ingredient cover should preserve a 1:1 aspect ratio");
assert.match(cover, /overflow:\s*hidden;/, "The square cover should clip its image layer");

const hero = selectorBody(".detail-hero");
assert.match(hero, /position:\s*relative;/, "The cover should provide the positioning context for the floating summary");

const image = selectorBody(".detail-hero__image");
assert.match(image, /position:\s*absolute;/, "The ingredient image should be a cover background layer");
assert.match(image, /inset:\s*0;/, "The cover image should fill the whole square cover");

const summary = selectorBody(".summary-card");
assert.match(summary, /position:\s*absolute;/, "The summary card should float over the ingredient image");
assert.match(summary, /left:\s*var\(--space-page\);/, "The summary card should align to the cover's left content edge");
assert.match(summary, /bottom:\s*54rpx;/, "The summary card should sit at the lower-left of the cover");

const contentScroll = selectorBody(".detail-content-scroll");
assert.match(contentScroll, /flex:\s*1;/, "The content area should take the remaining fixed viewport");
assert.match(contentScroll, /min-height:\s*0;/, "The content area should be shrinkable inside the fixed page");

assert.match(source, /onSessionCleared/, "Private pantry detail state should subscribe to session cleanup");
assert.match(source, /function clearPrivateState\(\)/, "Private pantry detail state should have one cleanup path");
assert.match(source, /currentItem\.value = null[\s\S]*itemImageUrl\.value = ""/, "Logout should clear the loaded item and private image");
assert.match(source, /<view v-if="sessionStore\.isLoggedIn" class="detail-hero">/, "The pantry summary must not remain visible for guests");
assert.match(source, /catch \(error\) \{[\s\S]*requestId !== contextRequestId[\s\S]*errorText\.value/, "A stale request must not restore private error state after logout");

console.log("pantry item-detail style tests passed");
