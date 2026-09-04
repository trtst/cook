import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  FridgeItemSummary,
  HomeFridgeRecipesResponse,
  IngredientSummary,
  MyRecipeDetail,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface LoginResult {
  token: string;
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function createFreshPhone() {
  return `139${String(Date.now()).slice(-6).padStart(6, "0")}${String(process.pid % 100).padStart(2, "0")}`;
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

async function loginWithCode(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function listSystemIngredients(headers: Record<string, string>) {
  const result = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=100&source=SYSTEM", {
    headers
  });
  assert(result.items.length >= 2, "system ingredients should have at least two entries");
  return result.items;
}

async function resolveRecipeCategory(headers: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", { headers });
  if (categories.length > 0) return categories[0];

  return requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({ name: `冰箱验收${nextIdempotencyKey().slice(-4)}` })
  });
}

async function createRecipe(headers: Record<string, string>, categoryId: number, name: string, ingredient: IngredientSummary) {
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name,
        story: "用于首页冰箱推荐验收",
        categoryId,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 1,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: null,
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "1",
            unitId: ingredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [{ slotKey: "step-1", text: "验收步骤", uploadId: null, imageUrl: null }]
      }
    })
  });
  const detail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, { headers });
  const published = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({ expectedVersion: detail.version })
  });
  return published.recipe;
}

async function createFridgeItem(headers: Record<string, string>, ingredient: IngredientSummary) {
  return requestData<FridgeItemSummary>("/fridge-items", {
    method: "POST",
    headers: withIdempotencyKey(headers),
    body: JSON.stringify({
      name: ingredient.name,
      ingredientId: ingredient.id,
      quantityText: "1份",
      exactQuantity: null,
      exactUnitId: null,
      expireAt: null,
      note: "首页冰箱推荐验收"
    })
  });
}

async function main() {
  const user = await loginWithCode(createFreshPhone());
  const auth = { authorization: `Bearer ${user.token}` };
  const ingredients = await listSystemIngredients(auth);
  const category = await resolveRecipeCategory(auth);
  const suffix = nextIdempotencyKey().slice(-6);
  const firstIngredient = ingredients[0]!;
  const secondIngredient = ingredients.find(item => item.id !== firstIngredient.id)!;

  const noFridgeRecipe = await createRecipe(auth, category.id, `冰箱空态验收${suffix}`, firstIngredient);
  const noFridgeResult = await requestData<HomeFridgeRecipesResponse>("/home/fridge-recipes", { headers: auth });
  assert(
    noFridgeResult.items.every(item => item.recipeId !== noFridgeRecipe.id),
    "home fridge recipes should be empty for recipes that match zero fridge ingredients"
  );

  await createFridgeItem(auth, secondIngredient);
  const noOverlapResult = await requestData<HomeFridgeRecipesResponse>("/home/fridge-recipes", { headers: auth });
  assert(
    noOverlapResult.items.every(item => item.recipeId !== noFridgeRecipe.id),
    "home fridge recipes should not include recipes with no ingredient overlap"
  );

  const matchingRecipe = await createRecipe(auth, category.id, `冰箱命中验收${suffix}`, secondIngredient);
  const matchingResult = await requestData<HomeFridgeRecipesResponse>("/home/fridge-recipes", { headers: auth });
  const matched = matchingResult.items.find(item => item.recipeId === matchingRecipe.id) ?? null;
  assert(matched, "home fridge recipes should include recipes matching fridge ingredients");
  assert(matched.matchedIngredientCount > 0, "home fridge recipes should report at least one matched ingredient");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        noFridgeRecipeId: noFridgeRecipe.id,
        matchingRecipeId: matchingRecipe.id,
        matchingCount: matched.matchedIngredientCount,
        returnedCount: matchingResult.items.length
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
