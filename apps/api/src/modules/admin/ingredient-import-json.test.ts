import assert from "node:assert/strict";
import test from "node:test";
import { parseIngredientImportSource } from "./ingredient-import-json";

function validDocument() {
  return {
    schemaVersion: "ingredient.import.v1",
    ingredients: [
      {
        name: "土豆",
        aliases: ["马铃薯", "洋芋"],
        categoryCode: "PRODUCE",
        defaultUnitName: "个",
        proteinType: null,
        isStaple: true,
        isSpicyIngredient: false,
        imageUrl: null,
        nutrition: {
          sourceVersion: "2026-08-22-primary-subset-v1",
          foodCode: "021101",
          foodName: "马铃薯[土豆、洋芋]",
          matchType: "ALIAS",
          confidence: 0.98,
          conversions: [{ unitName: "个", gramsPerUnit: 200 }]
        }
      }
    ]
  };
}

test("parses ingredient.import.v1 as an ingredients array without internal ids", () => {
  const result = parseIngredientImportSource({
    sourcePath: "ingredients.json",
    jsonText: JSON.stringify(validDocument())
  });

  assert.deepEqual(result.errorItems, []);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.name, "土豆");
  assert.deepEqual(result.items[0]?.aliases, ["马铃薯", "洋芋"]);
  assert.equal(result.items[0]?.nutrition?.foodCode, "021101");
  assert.equal(result.items[0]?.nutrition?.conversions[0]?.gramsPerUnit, 200);
});

test("rejects ingredient ids and unsupported fixed values", () => {
  const document = validDocument() as Record<string, unknown>;
  const item = (document.ingredients as Array<Record<string, unknown>>)[0];
  item.ingredientId = 10000000;
  item.categoryCode = "UNCLASSIFIED";
  item.proteinType = "PORKY";

  const result = parseIngredientImportSource({
    sourcePath: "invalid.json",
    jsonText: JSON.stringify(document)
  });

  assert.ok(result.errorItems.some(item => item.field === "ingredients.0.ingredientId"));
  assert.ok(result.errorItems.some(item => item.field === "ingredients.0.categoryCode"));
  assert.ok(result.errorItems.some(item => item.field === "ingredients.0.proteinType"));
});

test("requires nutrition foodCode to be explicitly supplied when nutrition is present", () => {
  const document = validDocument() as Record<string, any>;
  delete document.ingredients[0].nutrition.foodCode;

  const result = parseIngredientImportSource({
    sourcePath: "missing-food-code.json",
    jsonText: JSON.stringify(document)
  });

  assert.ok(result.errorItems.some(item => item.field === "ingredients.0.nutrition.foodCode"));
});

test("reports one duplicate issue when an ingredient name and alias hit the same earlier item", () => {
  const document = validDocument() as Record<string, any>;
  document.ingredients = [
    document.ingredients[0],
    {
      ...validDocument().ingredients[0],
      name: "马铃薯",
      aliases: ["土豆"]
    }
  ];

  const result = parseIngredientImportSource({
    sourcePath: "duplicate-name-and-alias.json",
    jsonText: JSON.stringify(document)
  });
  const duplicateIssues = result.errorItems.filter(item => item.field === "ingredients.1.name" && item.message === "与第 1 条食材的名称或别名重复");

  assert.equal(duplicateIssues.length, 1);
});
