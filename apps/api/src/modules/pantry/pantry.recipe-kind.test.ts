import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PantryService } from "./pantry.service";

const source = readFileSync(resolve(__dirname, "pantry.service.ts"), "utf8");

test("shopping source metadata classifies public recipes by inspiration state, not owner presence", () => {
  assert.match(source, /select:\s*\{\s*id:\s*true,\s*isInspiration:\s*true\s*\}/s);
  assert.match(source, /item\.isInspiration \? "inspiration" as const : "my" as const/);
  assert.doesNotMatch(source, /item\.ownerId \? "my" as const : "inspiration" as const/);
});

test("new shopping data resolves a historical merged ingredient to its active target", async () => {
  const service = new PantryService({} as never, {} as never, {} as never, {} as never);
  const ingredients = [{
    ingredientId: 10000024,
    ingredientName: "长茄子",
    source: "SYSTEM" as const,
    categoryId: 5001,
    amount: {
      kind: "EXACT" as const,
      quantity: "500",
      unitId: 3001,
      unitName: "克",
      unitType: "WEIGHT" as const
    }
  }];
  const tx = {
    ingredient: {
      findMany: async () => [{
        id: 10000024,
        ownerId: null,
        name: "长茄子",
        status: "MERGED",
        categoryId: 5001,
        mergedTo: {
          id: 10000001,
          ownerId: null,
          name: "茄子",
          status: "ACTIVE",
          categoryId: 5001
        }
      }]
    }
  };

  const result = await (service as any).currentShoppingIngredients(tx, ingredients);

  assert.deepEqual(result, [{
    ...ingredients[0],
    ingredientId: 10000001,
    ingredientName: "茄子",
    categoryId: 5001
  }]);
});

test("new shopping data rejects a merged ingredient whose target is not a system ingredient", async () => {
  const service = new PantryService({} as never, {} as never, {} as never, {} as never);
  const tx = {
    ingredient: {
      findMany: async () => [{
        id: 10000024,
        ownerId: null,
        name: "长茄子",
        status: "MERGED",
        categoryId: 5001,
        mergedTo: {
          id: 10000001,
          ownerId: 7,
          name: "个人茄子",
          status: "ACTIVE",
          categoryId: 5001
        }
      }]
    }
  };

  await assert.rejects(
    (service as any).currentShoppingIngredients(tx, [{
      ingredientId: 10000024,
      ingredientName: "长茄子",
      source: "SYSTEM",
      categoryId: 5001,
      amount: {
        kind: "EXACT",
        quantity: "500",
        unitId: 3001,
        unitName: "克",
        unitType: "WEIGHT"
      }
    }]),
    /归并目标无效/
  );
});
