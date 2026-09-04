import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  IngredientSummary,
  MyRecipeSummary,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftSummary,
  SaveRecipeDraftResponse
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
}

type AliasCandidate = {
  name: string;
  alias: string;
};

const aliasCandidates: AliasCandidate[] = [
  { name: "番茄", alias: "西红柿" },
  { name: "土豆", alias: "马铃薯" },
  { name: "香菇", alias: "冬菇" }
];

let idempotencySeed = Date.now();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
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

async function login(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function findIngredient(headers: Record<string, string>) {
  for (const candidate of aliasCandidates) {
    const list = await requestData<PageResult<IngredientSummary>>(
      `/ingredients?page=1&pageSize=20&source=SYSTEM&keyword=${encodeURIComponent(candidate.name)}`,
      { headers }
    );
    const matched = list.items.find(item => item.name === candidate.name);
    if (matched) {
      return {
        ingredient: matched,
        candidate
      };
    }
  }
  throw new Error("no seeded alias candidate ingredient found");
}

async function main() {
  const owner = await login(ownerPhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const { ingredient, candidate } = await findIngredient(ownerAuth);
  const suffix = nextIdempotencyKey().slice(-6);
  const category = await requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({ name: `别名验收${suffix}` })
  });

  const createdDraft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `别名搜索验收${suffix}`,
        story: `仅用于验证 ${candidate.alias} 搜索命中`,
        categoryId: category.id,
        inspirationCategoryId: null,
        sceneIds: [],
        originVersionId: null,
        originCoverImageUrl: null,
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: null,
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "",
            unitId: null,
            fuzzyText: "适量",
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: "验证别名搜索承接",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });

  const draftList = await requestData<PageResult<RecipeDraftSummary>>(
    `/recipe-drafts?page=1&pageSize=20&keyword=${encodeURIComponent(candidate.alias)}`,
    { headers: ownerAuth }
  );
  assert(draftList.items.some(item => item.id === createdDraft.id), `draft alias search should hit ${candidate.alias}`);

  const published = await requestData<{ recipe: { id: number; version: number } }>(`/recipe-drafts/${createdDraft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      expectedVersion: createdDraft.version
    })
  });

  const myRecipes = await requestData<PageResult<MyRecipeSummary>>(
    `/recipes?page=1&pageSize=20&keyword=${encodeURIComponent(candidate.alias)}`,
    { headers: ownerAuth }
  );
  assert(myRecipes.items.some(item => item.id === published.recipe.id), `recipe alias search should hit ${candidate.alias}`);

  console.log(
    JSON.stringify(
      {
        ingredientName: candidate.name,
        aliasKeyword: candidate.alias,
        draftId: createdDraft.id,
        recipeId: published.recipe.id
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
