import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("./RecipeImportItemPage.vue", import.meta.url), "utf8");

test("import item workbench keeps validation on the affected form fields", () => {
  assert.match(page, /function formField\(field: string\)/);
  assert.match(page, /"recipe\.content\.name": "title"/);
  assert.match(page, /replace\(\/\^recipe/);
  assert.match(page, /wiki\\\.tags/);
  assert.match(page, /const issueMessages = computed/);
  assert.match(page, /function formError\(\.\.\.fields: string\[\]\)/);
  assert.match(page, /:error="formError\('inspirationCategoryId'\)"/);
  assert.match(page, /:error="formError\('title'\)"/);
  assert.match(page, /:error="formError\(`ingredients\.\$\{index\}\.ingredientId`/);
  assert.match(page, /:error="formError\(`steps\.\$\{index\}\.text`/);
  assert.match(page, /:error="formError\(`assistantSteps\.\$\{index\}\.title`, `wiki\.assistant\.steps\.\$\{index\}\.title`\)"/);
});

test("import item workbench removes source metadata and keeps tag and assistant controls in one row", () => {
  assert.doesNotMatch(page, /class="toolbar-panel item-meta"/);
  assert.doesNotMatch(page, /class="table-panel source-panel"/);
  assert.match(page, /class="inline-edit-row tag-edit-row"/);
  assert.match(page, /\.tag-edit-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) auto;/);
  assert.match(page, /\.assistant-card__grid \{[\s\S]*grid-template-columns: 92px 120px minmax\(0, 1fr\) 120px minmax\(0, 1\.4fr\);/);
});
