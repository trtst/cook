import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const jobsPage = fs.readFileSync(new URL("./RecipeImportJobsPage.vue", import.meta.url), "utf8");
const itemPage = fs.readFileSync(new URL("./RecipeImportItemPage.vue", import.meta.url), "utf8");
const apiFile = fs.readFileSync(new URL("../apis/recipe.ts", import.meta.url), "utf8");
const controllerFile = fs.readFileSync(new URL("../../../api/src/modules/auth/admin.controller.ts", import.meta.url), "utf8");
const openapiFile = fs.readFileSync(new URL("../../../api/src/contracts/openapi.ts", import.meta.url), "utf8");
const typesFile = fs.readFileSync(new URL("../../../api/src/contracts/types.ts", import.meta.url), "utf8");
const dtosFile = fs.readFileSync(new URL("../../../api/src/contracts/dtos.ts", import.meta.url), "utf8");
const adminServiceFile = fs.readFileSync(new URL("../../../api/src/modules/admin/admin.service.ts", import.meta.url), "utf8");

test("import center accepts batch JSON files only", () => {
  assert.match(jobsPage, /accept="\.json"/);
  assert.match(jobsPage, /multiple/);
  assert.match(apiFile, /recipe-import-jobs\/json/);
  assert.match(apiFile, /formData\.append\("files"/);
  assert.match(jobsPage, /待审核系统项/);
  assert.doesNotMatch(controllerFile, /recipe-import-jobs\/markdown/);
  assert.doesNotMatch(controllerFile, /recipe-import-jobs\/excel/);
  assert.doesNotMatch(apiFile, /MARKDOWN|EXCEL/);
  assert.doesNotMatch(openapiFile, /MARKDOWN|EXCEL/);
  assert.doesNotMatch(typesFile, /RecipeImportSourceType = "JSON" \|/);
  assert.doesNotMatch(itemPage, /rawBody\.markdown/);
  assert.match(controllerFile, /FilesInterceptor\("files"/);
  assert.doesNotMatch(jobsPage, /zip/i);
  assert.doesNotMatch(apiFile, /zip/i);
});

test("import workbench requires complete content and disables publish with errors", () => {
  assert.match(itemPage, /label="故事" required/);
  assert.match(itemPage, /label="小贴士" required/);
  assert.match(itemPage, /:disabled="detail\?\.status !== 'READY' \|\| detail\.errorItems\.length > 0"/);
  assert.match(itemPage, /tagValueOptions/);
  assert.doesNotMatch(itemPage, /estimatedCalories/);
});

test("import workbench edits keywords, shows an unselected category, and supports cuisine and dish style", () => {
  assert.match(itemPage, /label="关键词"/);
  assert.match(itemPage, /form\.keywords/);
  assert.match(itemPage, /keywords: form\.keywords/);
  assert.match(itemPage, /待选择分类/);
  assert.match(itemPage, /\{ value: "CUISINE", label: "菜系" \}/);
  assert.match(itemPage, /\{ value: "DISH_STYLE", label: "菜式" \}/);
  assert.match(apiFile, /"CUISINE" \| "DISH_STYLE"/);
  assert.match(dtosFile, /\["CUISINE", "DISH_STYLE", "MEAL_TYPE"/);
  assert.match(openapiFile, /\["CUISINE", "DISH_STYLE", "MEAL_TYPE"/);
});

test("published recipe Wiki displays cuisine and dish style in Chinese", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  assert.match(detailPage, /CUISINE: "菜系"/);
  assert.match(detailPage, /DISH_STYLE: "菜式"/);
  assert.match(adminServiceFile, /SICHUAN_HUNAN: "川湘菜"/);
  assert.match(adminServiceFile, /STAPLE_FOOD: "主食"/);
});

test("clearing an imported remote image removes the source URL", () => {
  assert.match(itemPage, /form\.coverImageUrl = null/);
  assert.match(itemPage, /step\.imageUrl = null/);
});

test("recipe detail exposes the complete current-version Wiki area", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  assert.match(detailPage, /基本信息/);
  assert.match(detailPage, /质量卡/);
  assert.match(detailPage, /业务标签/);
  assert.match(detailPage, /qualityCards/);
  assert.match(detailPage, /wiki\.tags/);
  assert.match(detailPage, /wiki\.nutrition/);
  assert.match(detailPage, /durationMinutes/);
});

test("system recipe detail exposes JSON export and keywords", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  const apiFile = fs.readFileSync(new URL("../apis/recipe.ts", import.meta.url), "utf8");
  assert.match(detailPage, /导出 JSON/);
  assert.match(detailPage, /JSON\.stringify/);
  assert.match(apiFile, /keywords: string\[\]/);
  assert.match(detailPage, /schemaVersion: "recipe\.import\.v1"/);
  assert.match(detailPage, /recipe: \{/);
  assert.match(detailPage, /wiki: \{/);
  assert.match(detailPage, /recipeImportTagCodes/);
  assert.doesNotMatch(detailPage, /JSON\.stringify\(detail\.value/);
  const exportStart = detailPage.indexOf("function buildRecipeImportJson");
  const exportEnd = detailPage.indexOf("function exportJson");
  assert.ok(exportStart >= 0 && exportEnd > exportStart, "Expected an explicit import export mapper");
  assert.doesNotMatch(detailPage.slice(exportStart, exportEnd), /nutrition/);
});

test("recipe detail follows the four-section two-column layout", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  const basicIndex = detailPage.indexOf("detail-section--basic");
  const ingredientsStepsIndex = detailPage.indexOf("detail-section--ingredients-steps");
  const nutritionIndex = detailPage.indexOf("detail-section--nutrition");
  const assistantIndex = detailPage.indexOf("detail-section--assistant");

  assert.ok(basicIndex >= 0, "Expected a basic information section");
  assert.ok(ingredientsStepsIndex > basicIndex, "Expected ingredients and steps after basic information");
  assert.ok(nutritionIndex > ingredientsStepsIndex, "Expected nutrition after ingredients and steps");
  assert.ok(assistantIndex > nutritionIndex, "Expected assistant after nutrition");
  assert.match(detailPage, /detail-basic-grid/);
  assert.match(detailPage, /detail-ingredients-steps-grid/);
  assert.match(detailPage, /assistant-layout/);
});

test("recipe detail keeps正文内容 on a full-width row below the basic grid", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  const gridStart = detailPage.indexOf('<div class="detail-basic-grid">');
  const bodyStart = detailPage.indexOf('<div class="detail-basic-body">');
  const gridEnd = detailPage.lastIndexOf("\n          </div>", bodyStart);

  assert.ok(gridStart >= 0, "Expected the basic information grid");
  assert.ok(bodyStart >= 0, "Expected the正文内容 block");
  assert.ok(gridEnd >= 0, "Expected the basic information grid to close");
  assert.ok(bodyStart > gridEnd, "Expected正文内容 after the cover and basic information grid");
});

test("recipe editing preserves and submits the current tools", () => {
  const detailPage = fs.readFileSync(new URL("./RecipeDetailPage.vue", import.meta.url), "utf8");
  const apiFile = fs.readFileSync(new URL("../apis/recipe.ts", import.meta.url), "utf8");
  const openapiFile = fs.readFileSync(new URL("../../../api/src/contracts/openapi.ts", import.meta.url), "utf8");

  assert.match(detailPage, /form\.content\.tools/);
  assert.match(detailPage, /tools: form\.content\.tools/);
  assert.match(apiFile, /tools\??: Array<\{ name: string \}>/);
  assert.match(openapiFile, /tools\??: RecipeToolModel\[\]/);
});
