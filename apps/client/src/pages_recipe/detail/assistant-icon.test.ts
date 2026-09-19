import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const fontSource = readFileSync(resolve(__dirname, "../../assets/fonts/font.scss"), "utf8");

assert.equal(
  detailSource.match(/detail-inline-actions__icon icon-cook-assistant/g)?.length,
  3,
  "Expected all inline recipe assistant actions to use the dedicated icon."
);
assert.equal(
  detailSource.match(/cookfont icon-cook-assistant detail-actions__icon/g)?.length,
  3,
  "Expected all sticky recipe assistant actions to use the dedicated icon."
);
assert.ok(
  fontSource.includes('.icon-cook-assistant::before {\n    content: "\\e70e";\n}'),
  "Expected the cooking assistant icon to map to e70e."
);

console.log("recipe assistant icon passed");
