import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  CreateFridgeItemRequest,
  DiningEventSummary,
  FridgeItemSummary,
  FridgeSummaryResponse,
  IngredientSummary,
  MealPlanSummary,
  MyRecipeDetail,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse,
  ShoppingGapResponse,
  ShoppingListSummaryResponse,
  ShoppingListDetail,
  ShoppingListItemPatchResponse
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

let idempotencySeed =
  BigInt(Date.now()) * 1_000_000n +
  BigInt(process.pid) * 1_000n +
  BigInt(Math.floor(Math.random() * 1000));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

async function resolveRecipeCategory(ownerAuth: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: ownerAuth
  });
  if (categories.length) {
    return categories[0];
  }

  const suffix = nextIdempotencyKey().slice(-6);
  const created = await request<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `采购验收分类${suffix}` })
  });
  if (created.status >= 200 && created.status < 300 && created.body.code === 0) {
    return created.body.data;
  }

  const fallback = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: ownerAuth
  });
  assert(
    fallback.length > 0,
    `/recipe-categories fallback failed after create HTTP ${created.status}: ${created.body.message}`
  );
  return fallback[0];
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow: number) {
  return formatDateOnly(new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function buildQuantityText(quantity: string, unitName: string | null | undefined) {
  return `${quantity}${unitName ?? ""}`;
}

async function login() {
  return loginWithPassword(requestData, ownerPhone, password);
}

async function createPersonalIngredient(ownerAuth: Record<string, string>, template: IngredientSummary, name: string) {
  return requestData<IngredientSummary>("/ingredients", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name,
      categoryId: template.categoryId,
      defaultUnitId: template.defaultUnit.id
    })
  });
}

async function createOwnerRecipe(ownerAuth: Record<string, string>) {
  const systemIngredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: ownerAuth
  });
  assert(systemIngredients.items.length > 0, "system ingredients should be readable");
  const suffix = nextIdempotencyKey().slice(-6);
  const gapIngredient = await createPersonalIngredient(ownerAuth, systemIngredients.items[0], `采购验收缺口食材${suffix}`);
  const stockedIngredient = await createPersonalIngredient(ownerAuth, systemIngredients.items[0], `采购验收库存食材${suffix}`);
  const category = await resolveRecipeCategory(ownerAuth);
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `采购验收菜谱${suffix}`,
        story: "用于采购与冰箱闭环验收",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: null,
        ingredients: [
          {
            ingredientId: gapIngredient.id,
            name: gapIngredient.name,
            quantity: "2",
            unitId: gapIngredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: gapIngredient.categoryId,
            defaultUnitId: gapIngredient.defaultUnit.id,
            source: gapIngredient.source
          },
          {
            ingredientId: stockedIngredient.id,
            name: stockedIngredient.name,
            quantity: "2",
            unitId: stockedIngredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: stockedIngredient.categoryId,
            defaultUnitId: stockedIngredient.defaultUnit.id,
            source: stockedIngredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: "采购脚本验收步骤",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const draftDetail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, {
    headers: ownerAuth
  });
  const published = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ expectedVersion: draftDetail.version })
  });
  return {
    gapIngredient,
    stockedIngredient,
    recipe: published.recipe
  };
}

async function createMealPlan(ownerAuth: Record<string, string>, recipe: MyRecipeDetail) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  const startOffset = 120 + Number(titleSuffix.slice(-2));
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const result = await request<MealPlanSummary>("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        planDate: buildPlanDate(startOffset + attempt),
        mealSlot: "DINNER",
        title: `采购验收餐次-${titleSuffix}-${attempt}`,
        menuItems: [
          {
            slotType: "MEAT",
            sortOrder: 0,
            recipeId: recipe.id,
            recipeVersionId: recipe.contentVersionId,
            purchaseState: "PENDING"
          }
        ]
      })
    });
    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }
    if (result.body.code === 409 && result.body.message.includes("计划已存在")) {
      continue;
    }
    throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
  }
  throw new Error(`/meal-plans failed after 45 attempts due to existing plan conflicts (startOffset=${startOffset})`);
}

async function createFridgeItem(ownerAuth: Record<string, string>, ingredient: IngredientSummary) {
  const quantity = "1";
  const body: Omit<CreateFridgeItemRequest, "operationId"> = {
    name: ingredient.name,
    ingredientId: ingredient.id,
    quantityText: buildQuantityText(quantity, ingredient.defaultUnit.name),
    exactQuantity: quantity,
    exactUnitId: ingredient.defaultUnit.id,
    expireAt: null,
    note: "采购验收库存"
  };
  return requestData<FridgeItemSummary>("/fridge-items", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify(body)
  });
}

async function listFridge(ownerAuth: Record<string, string>) {
  return requestData<PageResult<FridgeItemSummary>>("/fridge-items?page=1&pageSize=50", {
    headers: ownerAuth
  });
}

async function getFridgeSummary(ownerAuth: Record<string, string>) {
  return requestData<FridgeSummaryResponse>("/fridge-items/summary", {
    headers: ownerAuth
  });
}

async function getShoppingListSummary(ownerAuth: Record<string, string>) {
  return requestData<ShoppingListSummaryResponse>("/shopping-lists/summary", {
    headers: ownerAuth
  });
}

async function main() {
  const owner = await login();
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const shoppingSummaryBefore = await getShoppingListSummary(ownerAuth);
  const { gapIngredient, stockedIngredient, recipe } = await createOwnerRecipe(ownerAuth);
  const groupedList = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `分组采购清单-${nextIdempotencyKey().slice(-6)}` })
  });
  const shoppingSummaryAfterGroupedList = await getShoppingListSummary(ownerAuth);
  const groupedAfterFirstItem = await requestData<ShoppingListDetail>(`/shopping-lists/${groupedList.id}/items`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: gapIngredient.name,
      ingredientId: gapIngredient.id,
      quantityText: buildQuantityText("1", gapIngredient.defaultUnit.name),
      note: "分组口径验收-1"
    })
  });
  const shoppingSummaryAfterFirstGroup = await getShoppingListSummary(ownerAuth);
  assert(
    shoppingSummaryAfterFirstGroup.pendingItemCount === shoppingSummaryAfterGroupedList.pendingItemCount + 1,
    "shopping list summary should add one pending group after the first grouped item"
  );
  const groupedAfterSecondItem = await requestData<ShoppingListDetail>(`/shopping-lists/${groupedList.id}/items`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: gapIngredient.name,
      ingredientId: gapIngredient.id,
      quantityText: buildQuantityText("2", gapIngredient.defaultUnit.name),
      note: "分组口径验收-2"
    })
  });
  assert(groupedAfterSecondItem.items.filter(item => item.ingredientId === gapIngredient.id).length >= 2, "grouped shopping list should keep duplicate ingredient rows");
  assert(groupedAfterSecondItem.progressTotalCount === groupedAfterFirstItem.progressTotalCount, "shopping list detail should still treat duplicate ingredient rows as one group");
  const shoppingSummaryAfterSecondGroup = await getShoppingListSummary(ownerAuth);
  assert(
    shoppingSummaryAfterSecondGroup.pendingItemCount === shoppingSummaryAfterFirstGroup.pendingItemCount,
    "shopping list summary should not double-count duplicate ingredient groups"
  );
  const groupedItems = groupedAfterSecondItem.items.filter(item => item.ingredientId === gapIngredient.id);
  const groupedAfterFirstCheck = await requestData<ShoppingListItemPatchResponse>(`/shopping-lists/${groupedList.id}/items/${groupedItems[0].id}/check`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      version: groupedAfterSecondItem.version,
      checked: true
    })
  });
  const shoppingSummaryAfterFirstCheck = await getShoppingListSummary(ownerAuth);
  assert(
    shoppingSummaryAfterFirstCheck.pendingItemCount === shoppingSummaryAfterSecondGroup.pendingItemCount,
    "shopping list summary should keep the group pending until all duplicate rows are done"
  );
  await requestData<ShoppingListItemPatchResponse>(`/shopping-lists/${groupedList.id}/items/${groupedItems[1].id}/check`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      version: groupedAfterFirstCheck.version,
      checked: true
    })
  });
  const shoppingSummaryAfterGroupedDone = await getShoppingListSummary(ownerAuth);
  assert(
    shoppingSummaryAfterGroupedDone.pendingItemCount === shoppingSummaryAfterSecondGroup.pendingItemCount - 1,
    "shopping list summary should drop the group only after all duplicate rows are completed"
  );
  const recipeList = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `菜谱采购清单-${nextIdempotencyKey().slice(-6)}` })
  });
  const recipeShoppingList = await requestData<ShoppingListDetail>(`/shopping-lists/${recipeList.id}/items/from-recipe`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      recipeId: recipe.id,
      sourceVersionId: recipe.contentVersionId
    })
  });
  assert(recipeShoppingList.items.length >= 2, "recipe shopping list should contain the recipe ingredients");
  assert(
    recipeShoppingList.items.some(
      item =>
        item.ingredientId === stockedIngredient.id &&
        item.sources.some(
          source =>
            source.sourceType === "RECIPE" &&
            source.recipeId === recipe.id &&
            source.sourceVersionId === recipe.contentVersionId
        )
    ),
    "recipe shopping list should keep RECIPE source traceability"
  );
  const shoppingSummaryAfterRecipe = await getShoppingListSummary(ownerAuth);
  assert(
    shoppingSummaryAfterRecipe.activeListCount >= shoppingSummaryBefore.activeListCount + 1,
    "shopping list summary should track newly created active lists"
  );
  assert(
    shoppingSummaryAfterRecipe.pendingItemCount > shoppingSummaryBefore.pendingItemCount,
    "shopping list summary should track pending shopping items"
  );

  const fridgeSummaryBefore = await getFridgeSummary(ownerAuth);
  const createdFridge = await createFridgeItem(ownerAuth, stockedIngredient);
  assert(createdFridge.ingredientId === stockedIngredient.id, "created fridge item should keep ingredient id");
  const fridgeSummaryAfterCreate = await getFridgeSummary(ownerAuth);
  assert(fridgeSummaryAfterCreate.totalCount > fridgeSummaryBefore.totalCount, "fridge summary total count should grow after creating an item");
  assert(
    fridgeSummaryAfterCreate.expiringCount >= fridgeSummaryBefore.expiringCount,
    "fridge summary expiring count should stay stable for a non-expiring item"
  );

  const scheduledAt = buildFutureIso(3);
  const plan = await createMealPlan(ownerAuth, recipe);
  const event = await requestData<DiningEventSummary>(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      scheduledAt,
      location: "采购验收饭局"
    })
  });

  const gap = await requestData<ShoppingGapResponse>("/shopping-gap", {
    headers: ownerAuth
  });
  const eventGapItem = gap.sections.flatMap(section => section.items).find(item => item.events.some(entry => entry.eventId === event.id));
  assert(eventGapItem, "shopping-gap should expose the created event");

  const gapList = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `缺口采购清单-${nextIdempotencyKey().slice(-6)}` })
  });
  const gapShoppingList = await requestData<ShoppingListDetail>(`/shopping-lists/${gapList.id}/items/from-gap`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      window: gap.sections.find(section => section.items.some(item => item.key === eventGapItem.key))?.window ?? "NEXT_48_HOURS",
      gapKeys: [eventGapItem.key]
    })
  });
  assert(
    gapShoppingList.items.some(
      item =>
        item.ingredientId === eventGapItem.ingredientId &&
        item.sources.some(source => source.sourceType === "EVENT")
    ),
    "from-gap shopping list should keep EVENT source and ingredient traceability"
  );

  const planList = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `计划采购清单-${nextIdempotencyKey().slice(-6)}` })
  });
  const planShoppingList = await requestData<ShoppingListDetail>(`/shopping-lists/${planList.id}/items/from-plan`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ planItemId: plan.id })
  });
  const planItem = planShoppingList.items.find(item => item.ingredientId === stockedIngredient.id);
  assert(planItem, "plan shopping list should keep ingredient id for fridge reservation");

  const eventGapList = await requestData<ShoppingListDetail>(`/shopping-lists/${planList.id}/items/from-event-gap`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ eventId: event.id })
  });
  assert(
    eventGapList.items.some(item => item.sources.some(source => source.sourceType === "EVENT")),
    "event gap list should keep EVENT sources in the bound shopping list"
  );

  const reloadedPlanList = await requestData<ShoppingListDetail>(`/shopping-lists/${planList.id}`, {
    headers: ownerAuth
  });
  const reservableItem = reloadedPlanList.items.find(item => item.id === planItem.id);
  assert(reservableItem?.fridgeActionMode === "APPLY_FULL" || reservableItem?.fridgeActionMode === "APPLY_PARTIAL", "plan list item should allow fridge apply");

  const applied = await requestData<ShoppingListItemPatchResponse>(`/shopping-lists/${planList.id}/items/${planItem.id}/fridge`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      version: reloadedPlanList.version,
      action: "APPLY"
    })
  });
  assert(applied.item?.inventoryApplied === true, "fridge apply should mark inventoryApplied");

  const fridgeAfterApply = await listFridge(ownerAuth);
  const reservedFridgeItem = fridgeAfterApply.items.find(item => item.id === createdFridge.id);
  assert(reservedFridgeItem?.reservations.some(item => item.shoppingListId === planList.id), "fridge detail should show reservation");

  const completed = await requestData<ShoppingListDetail>(`/shopping-lists/${planList.id}/complete`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      version: applied.version,
      entries: []
    })
  });
  assert(completed.status === "COMPLETED", "shopping list should become COMPLETED");

  const fridgeAfterComplete = await listFridge(ownerAuth);
  const settledFridgeItem = fridgeAfterComplete.items.find(item => item.id === createdFridge.id);
  assert(settledFridgeItem, "settled fridge item should still exist");
  assert(settledFridgeItem.reservations.length === 0, "shopping list completion should settle fridge reservations");
  assert(Number(settledFridgeItem.exactQuantity || "0") < Number(createdFridge.exactQuantity || "0"), "fridge quantity should be deducted after completion");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        recipeListId: recipeShoppingList.id,
        recipeItemCount: recipeShoppingList.items.length,
        eventId: event.id,
        eventGapItemKey: eventGapItem.key,
        eventGapListId: eventGapList.id,
        planListId: planShoppingList.id,
        planItemId: planItem.id,
        fridgeItemId: createdFridge.id,
        appliedInventory: applied.item?.inventoryApplied ?? false,
        completedStatus: completed.status,
        fridgeQuantityBefore: createdFridge.exactQuantity,
        fridgeQuantityAfter: settledFridgeItem.exactQuantity
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
