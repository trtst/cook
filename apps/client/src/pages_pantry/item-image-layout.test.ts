import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readPage(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function selectorBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector to exist: ${selector}`);
  return match[1];
}

const pantryHomeSource = readPage("./index/index.vue");
const shoppingDetailSource = readPage("./list-detail/index.vue");
const imageEmptySource = readPage("../components/ImageEmpty.vue");

const defaultImageIcon = selectorBody(imageEmptySource, ".image-empty__icon");
assert.match(
  defaultImageIcon,
  /font-size:\s*var\(--image-empty-icon-size, 100rpx\);/,
  "Default-image icons should support a local size while retaining the shared 100rpx fallback"
);

const pantryCard = selectorBody(pantryHomeSource, ".item-card");
assert.match(pantryCard, /padding:\s*20rpx 24rpx;/, "Pantry item cards should retain their original inner padding");
assert.match(pantryCard, /gap:\s*20rpx;/, "Pantry item cards should retain their original image-to-content gap");

const pantryMedia = selectorBody(pantryHomeSource, ".item-card__media");
assert.match(pantryMedia, /flex:\s*0 0 140rpx;/, "Pantry item media should match the shopping-detail image width");

const pantryImage = selectorBody(pantryHomeSource, ".item-card__image");
assert.match(pantryImage, /width:\s*140rpx;/, "Pantry item images should match the shopping-detail image width");
assert.match(pantryImage, /height:\s*140rpx;/, "Pantry item images should stay square");
assert.match(pantryImage, /border-radius:\s*var\(--radius-sm\);/, "Pantry item images should retain their original rounding");
assert.match(pantryImage, /--image-empty-icon-size:\s*80rpx;/, "Pantry item default-image icons should be 80rpx");

const pantryMain = selectorBody(pantryHomeSource, ".item-card__main");
assert.match(pantryMain, /min-height:\s*140rpx;/, "Pantry item information should match the enlarged square image");
assert.doesNotMatch(pantryMain, /padding:/, "Pantry item information should rely on the card padding");

assert.match(
  pantryHomeSource,
  /<view class="item-card__identity">\s*<text class="item-card__name">\{\{ card\.name \}\}<\/text>\s*<text class="item-card__category">\{\{ card\.categoryText \}\}<\/text>\s*<\/view>/,
  "Pantry item categories should appear directly after the ingredient name"
);
assert.ok(
  pantryHomeSource.includes('<text class="item-card__meta">{{ card.stockText }}</text>'),
  "Pantry item metadata should keep only the stock text"
);
assert.ok(
  !pantryHomeSource.includes("{{ card.stockText }} · {{ card.categoryText }}"),
  "Pantry item categories should not be repeated in the stock row"
);

const pantryIdentity = selectorBody(pantryHomeSource, ".item-card__identity");
assert.match(pantryIdentity, /display:\s*flex;/, "Pantry item names and categories should remain on one row");

const pantryCategory = selectorBody(pantryHomeSource, ".item-card__category");
assert.match(pantryCategory, /font-size:\s*var\(--font-size-xs\);/, "Pantry item categories should use the smaller text size");
assert.match(pantryCategory, /font-weight:\s*var\(--font-weight-regular\);/, "Pantry item categories should not be bold");

assert.ok(
  shoppingDetailSource.includes('import ImageLoader from "@/components/ImageLoader.vue";'),
  "Shopping-list ingredients should use the shared default-image behavior"
);
assert.ok(
  shoppingDetailSource.includes('<ImageLoader class="item-row__image" :src="group.imageUrl" />'),
  "Shopping-list ingredients should render their image through ImageLoader"
);
assert.ok(!shoppingDetailSource.includes('class="item-row__placeholder"'), "Shopping-list ingredients should not use a text placeholder");

const shoppingImage = selectorBody(shoppingDetailSource, ".item-row__image");
assert.match(shoppingImage, /width:\s*140rpx;/, "Shopping-list ingredient images should keep their fixed width");
assert.match(shoppingImage, /height:\s*140rpx;/, "Shopping-list ingredient images should stay square");
assert.match(shoppingImage, /--image-empty-icon-size:\s*80rpx;/, "Shopping-list default-image icons should be 80rpx");

console.log("pantry item image layout tests passed");
