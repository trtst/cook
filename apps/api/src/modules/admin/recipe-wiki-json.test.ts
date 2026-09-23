import assert from "node:assert/strict";
import test from "node:test";
import { parseRecipeWikiDocument } from "./recipe-wiki-json";
import { safeRecipeWikiImportErrorMessage } from "./admin.service";

const step = {
  order: 1,
  phase: "COOK",
  action: "STIR_FRY",
  title: "翻炒",
  detail: "翻炒至熟。",
  imageUrl: null,
  imagePrompt: null,
  durationMinutes: 5,
  durationText: "约 5 分钟"
};

test("parses a single Wiki export with recipe and content version IDs", () => {
  const result = parseRecipeWikiDocument({
    schemaVersion: "recipe.wiki.v1",
    recipeId: 100,
    contentVersionId: 200,
    wiki: {
      tags: [{ tagCode: "DISH_STYLE", tagValue: "STIR_FRY" }],
      assistant: { steps: [step] }
    }
  });

  assert.deepEqual(result, {
    items: [{
      recipeId: 100,
      contentVersionId: 200,
      tags: [{ tagCode: "DISH_STYLE", tagValue: "STIR_FRY" }],
      assistantSteps: [step]
    }],
    issues: []
  });
});

test("does not expose internal errors in the Wiki import result", () => {
  assert.equal(safeRecipeWikiImportErrorMessage(new Error("Prisma connection details")), "Wiki 导入失败");
});

test("expands a batch Wiki export and rejects unknown non-Wiki fields", () => {
  const result = parseRecipeWikiDocument({
    schemaVersion: "recipe.wiki.batch.v1",
    recipes: [
      {
        recipeId: 100,
        contentVersionId: 200,
        wiki: { tags: [], assistant: { steps: [step] } }
      }
    ],
    content: { name: "不得导入正文" }
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.recipeId, 100);
  assert.match(result.issues.map(item => item.message).join("\n"), /不支持|正文|字段/);
});

test("rejects a Wiki export without the fixed content version", () => {
  const result = parseRecipeWikiDocument({
    schemaVersion: "recipe.wiki.v1",
    recipeId: 100,
    wiki: { tags: [], assistant: { steps: [step] } }
  });

  assert.equal(result.items.length, 0);
  assert.match(result.issues.map(item => item.message).join("\n"), /contentVersionId/);
});

test("rejects duplicate Wiki tags before persistence", () => {
  const result = parseRecipeWikiDocument({
    schemaVersion: "recipe.wiki.v1",
    recipeId: 100,
    contentVersionId: 200,
    wiki: {
      tags: [
        { tagCode: "DISH_STYLE", tagValue: "STIR_FRY" },
        { tagCode: "DISH_STYLE", tagValue: "STIR_FRY" }
      ],
      assistant: { steps: [step] }
    }
  });

  assert.equal(result.items.length, 1);
  assert.match(result.issues.map(item => item.message).join("\n"), /标签重复/);
});
