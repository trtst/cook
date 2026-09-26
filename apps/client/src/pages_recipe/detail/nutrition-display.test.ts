import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const scriptSource = detailSource.slice(detailSource.indexOf("<script setup"), detailSource.indexOf("</script>"));
const fuzzyPolicy = scriptSource.slice(scriptSource.indexOf("const hasFuzzyIngredient"), scriptSource.indexOf("const nutritionMotionTick"));
const sectionPolicy = scriptSource.slice(scriptSource.indexOf("const showNutritionSection"), scriptSource.indexOf("const anchorTabs"));
const completenessCheck = scriptSource.slice(scriptSource.indexOf("function hasCompleteNutrition"), scriptSource.indexOf("function formatNutritionNumber"));

assert.match(
  fuzzyPolicy,
  /detailContent\.value\.ingredients\.some\(item => item\.amount\.kind === "FUZZY"\)/
);
assert.match(
  completenessCheck,
  /calories[\s\S]*?protein[\s\S]*?fat[\s\S]*?carbohydrate/
);
assert.match(
  sectionPolicy,
  /hasFuzzyIngredient\.value[\s\S]*?status === "COMPLETE"[\s\S]*?status === "ESTIMATED"[\s\S]*?hasCompleteNutrition\(currentNutritionMetrics\.value\)/,
  "Expected the nutrition section to stay hidden for fuzzy ingredient amounts or incomplete metrics."
);
assert.match(detailSource, /<view v-if="showNutritionSection" id="detail-nutrition" class="section">/);
assert.doesNotMatch(detailSource, /暂无营养估算/);

console.log("recipe nutrition display boundary passed");
