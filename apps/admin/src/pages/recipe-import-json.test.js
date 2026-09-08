import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const jobsPage = fs.readFileSync(new URL("./RecipeImportJobsPage.vue", import.meta.url), "utf8");
const itemPage = fs.readFileSync(new URL("./RecipeImportItemPage.vue", import.meta.url), "utf8");
const apiFile = fs.readFileSync(new URL("../apis/recipe.ts", import.meta.url), "utf8");
const controllerFile = fs.readFileSync(new URL("../../../api/src/modules/auth/admin.controller.ts", import.meta.url), "utf8");
const openapiFile = fs.readFileSync(new URL("../../../api/src/contracts/openapi.ts", import.meta.url), "utf8");
const typesFile = fs.readFileSync(new URL("../../../api/src/contracts/types.ts", import.meta.url), "utf8");

test("import center accepts JSON and ZIP JSON only", () => {
  assert.match(jobsPage, /accept="\.json,\.zip"/);
  assert.match(apiFile, /recipe-import-jobs\/json/);
  assert.match(jobsPage, /待审核系统项/);
  assert.doesNotMatch(controllerFile, /recipe-import-jobs\/markdown/);
  assert.doesNotMatch(controllerFile, /recipe-import-jobs\/excel/);
  assert.doesNotMatch(apiFile, /MARKDOWN|EXCEL/);
  assert.doesNotMatch(openapiFile, /MARKDOWN|EXCEL/);
  assert.doesNotMatch(typesFile, /RecipeImportSourceType = "JSON" \|/);
  assert.doesNotMatch(itemPage, /rawBody\.markdown/);
});

test("import workbench requires complete content and disables publish with errors", () => {
  assert.match(itemPage, /label="故事" required/);
  assert.match(itemPage, /label="小贴士" required/);
  assert.match(itemPage, /:disabled="detail\?\.status !== 'READY' \|\| detail\.errorItems\.length > 0"/);
  assert.match(itemPage, /tagValueOptions/);
  assert.doesNotMatch(itemPage, /estimatedCalories/);
});

test("clearing an imported remote image removes the source URL", () => {
  assert.match(itemPage, /form\.coverImageUrl = null/);
  assert.match(itemPage, /step\.imageUrl = null/);
});
