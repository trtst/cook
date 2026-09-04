import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type { InspirationRecipeSummary, PageResult, RecipeViewHistoryItem } from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const ownerPhone = process.env.TEST_OWNER_PHONE ?? "13800000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  return loginWithPassword(requestData, ownerPhone, password);
}

async function main() {
  const anonymous = await request<{ items: RecipeViewHistoryItem[] }>("/users/me/recipe-history?page=1&pageSize=20");
  assert(anonymous.status === 401, `anonymous history request should return 401, got ${anonymous.status}`);

  const session = await login();
  const headers = { authorization: `Bearer ${session.token}` };
  const recipes = await requestData<PageResult<InspirationRecipeSummary>>("/inspiration-recipes?page=1&pageSize=20");
  const recipe = recipes.items[0];
  assert(recipe, "seeded inspiration recipe is required");

  const recorded = await requestData<RecipeViewHistoryItem>("/users/me/recipe-history", {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": String(Date.now()) },
    body: JSON.stringify({ recipeId: recipe.id })
  });
  assert(recorded.recipeId === recipe.id, "recorded history should reference the viewed recipe");

  const repeated = await requestData<RecipeViewHistoryItem>("/users/me/recipe-history", {
    method: "POST",
    headers: { ...headers, "Idempotency-Key": String(Date.now() + 1) },
    body: JSON.stringify({ recipeId: recipe.id })
  });
  assert(repeated.id === recorded.id, "repeated views should reuse one history row");
  assert(repeated.lastViewedAt >= recorded.lastViewedAt, "repeated view should refresh lastViewedAt");

  const history = await requestData<PageResult<RecipeViewHistoryItem>>("/users/me/recipe-history?page=1&pageSize=20", { headers });
  const item = history.items.find(current => current.id === recorded.id);
  assert(item, "history list should contain the recorded recipe");
  assert(item.title === recipe.title, "history list should expose the latest recipe title");
  assert(item.sourceType === "INSPIRATION", "history list should expose the inspiration source");
  assert(history.total >= 1, "history list should expose a total count");

  console.log("recipe history flow passed");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
