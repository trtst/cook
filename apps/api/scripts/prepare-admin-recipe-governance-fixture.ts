import { loadLocalEnv } from "../src/common/load-env";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const testCode = "123456";

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface CodeLoginResult {
  token: string;
  expiresAt: string;
  user: {
    uid: number;
  };
}

interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

interface IngredientCategorySummary {
  id: number;
  name: string;
}

interface RecipeCategorySummary {
  id: number;
  name: string;
}

interface InspirationCategorySummary {
  id: number;
  name: string;
}

interface UnitSummary {
  id: number;
  name: string;
  type: "WEIGHT" | "VOLUME" | "COMMON" | "PACKAGE";
}

interface IngredientSummary {
  id: number;
  name: string;
  categoryId: number;
  defaultUnit: UnitSummary;
  source: "SYSTEM" | "PERSONAL";
}

interface IngredientRecommendationSummary {
  id: number;
  status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
}

interface UnitRecommendationSummary {
  id: number;
  status: "PENDING" | "REJECTED" | "ADOPTED" | "MERGED";
}

interface SaveRecipeDraftResponse {
  id: number;
  version: number;
}

interface PublishRecipeResponse {
  recipe: {
    id: number;
  };
}

interface RecipeRecommendationSummary {
  id: number;
  status: "PENDING" | "REJECTED" | "ADOPTED" | "WITHDRAWN";
}

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

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
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

async function loginUserWithCode(phone: string) {
  return requestData<CodeLoginResult>("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: testCode
    })
  });
}

async function main() {
  const session = await loginUserWithCode(createFreshPhone());
  const authHeaders = {
    authorization: `Bearer ${session.token}`
  };
  const suffix = nextIdempotencyKey().slice(-6);

  const [ingredientCategories, systemUnits, systemIngredients, inspirationCategories] = await Promise.all([
    requestData<IngredientCategorySummary[]>("/ingredient-categories", {
      headers: authHeaders
    }),
    requestData<PageResult<UnitSummary>>("/units?page=1&pageSize=100&source=SYSTEM", {
      headers: authHeaders
    }),
    requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
      headers: authHeaders
    }),
    requestData<InspirationCategorySummary[]>("/inspiration-categories")
  ]);

  assert(ingredientCategories.length > 0, "missing ingredient categories");
  assert(systemUnits.items.length > 0, "missing system units");
  assert(systemIngredients.items.length > 0, "missing system ingredients");
  assert(inspirationCategories.length > 0, "missing inspiration categories");

  const ingredientCategory = ingredientCategories[0];
  const defaultUnit = systemUnits.items[0];
  const systemIngredient = systemIngredients.items[0];
  const inspirationCategory = inspirationCategories[0];

  const ingredientName = `后台待审食材${suffix}`;
  const unitName = `后台待审单位${suffix}`;
  const recipeCategoryName = `后台待审分类${suffix}`;
  const recipeName = `后台待审菜谱${suffix}`;

  const createdIngredient = await requestData<IngredientSummary>("/ingredients", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: ingredientName,
      categoryId: ingredientCategory.id,
      defaultUnitId: defaultUnit.id
    })
  });
  assert(createdIngredient.source === "PERSONAL", "new ingredient should be personal");

  const ingredientRecommendation = await requestData<IngredientRecommendationSummary>(
    `/ingredients/${createdIngredient.id}/recommendations`,
    {
      method: "POST",
      headers: withIdempotencyKey(authHeaders)
    }
  );
  assert(ingredientRecommendation.status === "PENDING", "ingredient recommendation should stay pending");

  const unitRecommendation = await requestData<UnitRecommendationSummary>("/units", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: unitName,
      type: "WEIGHT"
    })
  });
  assert(unitRecommendation.status === "PENDING", "unit recommendation should stay pending");

  const recipeCategory = await requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: recipeCategoryName
    })
  });

  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: recipeName,
        story: "仅用于后台治理页浏览器证据",
        categoryId: recipeCategory.id,
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
            ingredientId: systemIngredient.id,
            name: systemIngredient.name,
            quantity: "",
            unitId: null,
            fuzzyText: "适量",
            categoryId: systemIngredient.categoryId,
            defaultUnitId: systemIngredient.defaultUnit.id,
            source: systemIngredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: "后台治理页浏览器证据用步骤",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });

  const published = await requestData<PublishRecipeResponse>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      expectedVersion: draft.version
    })
  });

  const recipeRecommendation = await requestData<RecipeRecommendationSummary>(
    `/recipes/${published.recipe.id}/recommendations`,
    {
      method: "POST",
      headers: withIdempotencyKey(authHeaders),
      body: JSON.stringify({
        inspirationCategoryId: inspirationCategory.id
      })
    }
  );
  assert(recipeRecommendation.status === "PENDING", "recipe recommendation should stay pending");

  console.log(
    JSON.stringify(
      {
        phone: "created-by-code-login",
        userUid: session.user.uid,
        ingredient: {
          id: createdIngredient.id,
          name: ingredientName,
          adminPath: "/ingredients/pending"
        },
        unit: {
          id: unitRecommendation.id,
          name: unitName,
          adminPath: "/ingredients/units"
        },
        recipe: {
          id: published.recipe.id,
          title: recipeName,
          adminPath: "/recipes/pending"
        }
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
