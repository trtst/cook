import { loadLocalEnv } from "../src/common/load-env";
import type {
  CheckRandomMenuGapResponse,
  IngredientSummary,
  MealPlanSummary,
  MyRecipeDetail,
  PageResult,
  RandomMenuItem,
  RandomMenuResponse,
  RecipeCategorySummary,
  RecipeDraftDetail,
  ReplaceRandomMenuSlotResponse,
  SaveRecipeDraftResponse,
  ShoppingItemSummary
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
  user: {
    uid: number;
  };
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow: number) {
  const extraDays = Number(nextIdempotencyKey().slice(-2)) % 20;
  return formatDateOnly(new Date(Date.now() + (daysFromNow + extraDays) * 24 * 60 * 60 * 1000));
}

async function createMealPlanFromRandom(
  ownerAuth: Record<string, string>,
  titlePrefix: string,
  titleSuffix: string,
  items: RandomMenuItem[]
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request<MealPlanSummary>("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        planDate: buildPlanDate(45 + attempt),
        mealSlot: "DINNER",
        title: `${titlePrefix}-${titleSuffix}-${attempt}`,
        menuItems: items
          .slice()
          .sort((left, right) => left.slotIndex - right.slotIndex)
          .map(item => ({
            slotType: item.slotType,
            sortOrder: item.slotIndex,
            recipeId: item.recipeId,
            recipeVersionId: item.recipeVersionId,
            purchaseState: "READY"
          }))
      })
    });
    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }
    if (result.status === 409 && result.body.message.includes("计划已存在")) {
      continue;
    }
    throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
  }
  throw new Error("/meal-plans failed after 10 attempts due to existing plan conflicts");
}

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-cook-from": "mini_program",
      "x-cook-version": "0.1.0",
      ...options.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}) {
  const result = await request<T>(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function login() {
  return requestData<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ phone: ownerPhone, password })
  });
}

async function resolveRecipeCategory(headers: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers
  });
  if (categories.length) {
    return categories[0];
  }

  const suffix = nextIdempotencyKey().slice(-6);
  const created = await request<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({ name: `随机验收分类${suffix}` })
  });
  if (created.status >= 200 && created.status < 300 && created.body.code === 0) {
    return created.body.data;
  }

  const fallback = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers
  });
  assert(fallback.length > 0, "recipe categories should exist after fallback reload");
  return fallback[0];
}

async function listSystemIngredients(headers: Record<string, string>) {
  const result = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=100&source=SYSTEM", {
    headers
  });
  assert(result.items.length > 0, "system ingredients should be readable");
  return result.items;
}

function requireIngredient(ingredients: IngredientSummary[], name: string) {
  const item = ingredients.find(entry => entry.name === name) ?? null;
  assert(item, `system ingredient ${name} should exist`);
  return item;
}

async function createOwnedRecipe(
  headers: Record<string, string>,
  categoryId: number,
  input: {
    name: string;
    story: string;
    ingredients: Array<{
      ingredient: IngredientSummary;
      quantity: string;
    }>;
  }
) {
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: input.name,
        story: input.story,
        categoryId,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "随机页验收样本",
        ingredients: input.ingredients.map(item => ({
          ingredientId: item.ingredient.id,
          name: item.ingredient.name,
          quantity: item.quantity,
          unitId: item.ingredient.defaultUnit.id,
          fuzzyText: null,
          categoryId: item.ingredient.categoryId,
          defaultUnitId: item.ingredient.defaultUnit.id,
          source: item.ingredient.source
        })),
        steps: [
          {
            slotKey: "step-1",
            text: "随机页验收步骤",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const detail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, {
    headers
  });
  const published = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({ expectedVersion: detail.version })
  });
  return published.recipe;
}

function replaceMenuItem(items: RandomMenuItem[], slot: RandomMenuItem) {
  return items.map(item => (item.slotId === slot.slotId ? slot : item));
}

async function main() {
  const owner = await login();
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const ingredients = await listSystemIngredients(ownerAuth);
  const category = await resolveRecipeCategory(ownerAuth);
  const suffix = nextIdempotencyKey().slice(-6);

  const chicken = requireIngredient(ingredients, "鸡肉");
  const pork = requireIngredient(ingredients, "猪肉");
  const cabbage = requireIngredient(ingredients, "白菜");
  const pepper = requireIngredient(ingredients, "青椒");
  const onion = requireIngredient(ingredients, "洋葱");
  const garlic = requireIngredient(ingredients, "大蒜");

  const [chickenRecipe, porkRecipe, vegetableRecipe] = await Promise.all([
    createOwnedRecipe(ownerAuth, category.id, {
      name: `随机验收鸡肉小炒${suffix}`,
      story: "用于随机页生成与换菜验收",
      ingredients: [
        { ingredient: chicken, quantity: "200" },
        { ingredient: pepper, quantity: "2" }
      ]
    }),
    createOwnedRecipe(ownerAuth, category.id, {
      name: `随机验收猪肉小炒${suffix}`,
      story: "用于随机页换菜验收",
      ingredients: [
        { ingredient: pork, quantity: "200" },
        { ingredient: onion, quantity: "1" }
      ]
    }),
    createOwnedRecipe(ownerAuth, category.id, {
      name: `随机验收清炒白菜${suffix}`,
      story: "用于随机页缺口验收",
      ingredients: [
        { ingredient: cabbage, quantity: "1" },
        { ingredient: garlic, quantity: "2" }
      ]
    })
  ]);

  const generated = await requestData<RandomMenuResponse>("/random-menus/generate", {
    method: "POST",
    headers: ownerAuth,
    body: JSON.stringify({
      mealSlot: "DINNER",
      peopleCount: 2,
      fridgePreferred: false,
      slotPlan: {
        meatCount: 1,
        vegetableCount: 1,
        soupCount: 0,
        stapleCount: 0,
        breakfastStapleCount: 0,
        breakfastProteinCount: 0,
        breakfastSideCount: 0
      }
    })
  });
  assert(generated.items.length === 2, "random generate should return the requested two-slot dinner menu");
  const meatSlot = generated.items.find(item => item.slotType === "MEAT") ?? null;
  const vegetableSlot = generated.items.find(item => item.slotType === "VEGETABLE") ?? null;
  assert(meatSlot, "generated menu should include a meat slot");
  assert(vegetableSlot, "generated menu should include a vegetable slot");

  const replace = await requestData<ReplaceRandomMenuSlotResponse>("/random-menu-slots/replace", {
    method: "POST",
    headers: ownerAuth,
    body: JSON.stringify({
      mealSlot: "DINNER",
      peopleCount: 2,
      fridgePreferred: false,
      slotPlan: generated.slotPlan,
      currentItems: generated.items.map(item => ({
        slotId: item.slotId,
        slotType: item.slotType,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId
      })),
      targetSlotId: meatSlot.slotId,
      targetSlotType: meatSlot.slotType,
      replaceConstraints: [],
      rejectedRecipeVersionIds: [meatSlot.recipeVersionId],
      requestSeq: 1
    })
  });
  assert(replace.requestSeq === 1, "replace response should preserve requestSeq");
  assert(replace.slot, "replace response should return a replacement slot");
  assert(replace.slot.slotId === meatSlot.slotId, "replacement slot should target the same slot");
  assert(replace.slot.recipeVersionId !== meatSlot.recipeVersionId, "replacement slot should change the meat recipe");

  const finalItems = replaceMenuItem(generated.items, replace.slot);
  const gap = await requestData<CheckRandomMenuGapResponse>("/random-menu-gap/preview", {
    method: "POST",
    headers: ownerAuth,
    body: JSON.stringify({
      mealSlot: "DINNER",
      peopleCount: 2,
      items: finalItems.map(item => ({
        slotId: item.slotId,
        slotType: item.slotType,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId
      })),
      inventoryDecisions: []
    })
  });
  assert(gap.items.length === finalItems.length, "gap preview should return one record per menu slot");
  assert(gap.summary.missingCount + gap.summary.partialCount + gap.summary.unknownCount >= 1, "gap preview should surface unresolved ingredients");
  assert(gap.canCreatePlan === false, "gap preview should block create plan before inventory decisions are handled");
  const unresolvedInventoryStatuses = gap.items.flatMap(item => item.missingIngredients.map(ingredient => ingredient.inventoryStatus));
  assert(
    unresolvedInventoryStatuses.some(status => status === "MISSING" || status === "PARTIAL" || status === "UNKNOWN"),
    "gap preview should expose at least one unresolved inventory status before decisions are handled"
  );

  const shoppingPayload = gap.items
    .filter(item => item.missingIngredients.length > 0)
    .map(item => ({
      slotId: item.slotId,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      ingredients: item.missingIngredients
        .filter(ingredient => ingredient.inventoryStatus !== "UNKNOWN")
        .map(ingredient => ({
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
          quantityText: ingredient.quantityText
        }))
    }))
    .filter(item => item.ingredients.length > 0);
  assert(shoppingPayload.length > 0, "shopping payload should contain at least one missing ingredient");

  const shoppingOperationId = nextIdempotencyKey();
  const [shoppingA, shoppingB] = await Promise.all([
    requestData<ShoppingItemSummary[]>("/shopping-items/from-random-menu", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth, shoppingOperationId),
      body: JSON.stringify({ items: shoppingPayload })
    }),
    requestData<ShoppingItemSummary[]>("/shopping-items/from-random-menu", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth, shoppingOperationId),
      body: JSON.stringify({ items: shoppingPayload })
    })
  ]);
  assert(shoppingA.length === shoppingB.length, "random shopping idempotency replay should keep the same item count");
  assert(shoppingA.length > 0, "random shopping write should create shopping items");
  assert(shoppingA.every(item => item.sourceType === "RANDOM_MENU"), "random shopping write should keep RANDOM_MENU source type");

  const resolvedGap = await requestData<CheckRandomMenuGapResponse>("/random-menu-gap/preview", {
    method: "POST",
    headers: ownerAuth,
    body: JSON.stringify({
      mealSlot: "DINNER",
      peopleCount: 2,
      items: finalItems.map(item => ({
        slotId: item.slotId,
        slotType: item.slotType,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId
      })),
      inventoryDecisions: gap.items.flatMap(item =>
        item.missingIngredients.map(ingredient => ({
          slotId: item.slotId,
          ingredientId: ingredient.ingredientId,
          ingredientName: ingredient.ingredientName,
          decision: "HAS"
        }))
      )
    })
  });
  assert(resolvedGap.canCreatePlan === true, "gap preview should allow create plan after all missing ingredients are handled");
  assert(
    resolvedGap.items.every(item => item.missingIngredients.length === 0),
    "resolved gap preview should clear missing ingredients after all decisions are marked HAS"
  );
  assert(resolvedGap.summary.missingCount === 0, "resolved gap preview should clear missing summary count");
  assert(resolvedGap.summary.partialCount === 0, "resolved gap preview should clear partial summary count");
  assert(resolvedGap.summary.unknownCount === 0, "resolved gap preview should clear unknown summary count");

  const createdPlan = await createMealPlanFromRandom(ownerAuth, "随机验收餐次", suffix, finalItems);
  assert(createdPlan.mealSlot === "DINNER", "created plan should keep the random meal slot");
  assert(createdPlan.menuItems.length === finalItems.length, "created plan should keep all final random slots");
  assert(
    createdPlan.menuItems.some(item => item.recipeVersionId === replace.slot.recipeVersionId),
    "created plan should include the replaced recipe version"
  );

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        generatedCount: generated.items.length,
        replacedSlotId: replace.slot.slotId,
        replacedRecipeVersionId: replace.slot.recipeVersionId,
        shoppingItemCount: shoppingA.length,
        planId: createdPlan.id,
        planMenuCount: createdPlan.menuItems.length,
        canCreatePlanBefore: gap.canCreatePlan,
        canCreatePlanAfter: resolvedGap.canCreatePlan
      },
      null,
      2
    )
  );
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
