import { loadLocalEnv } from "../src/common/load-env";
import { loginWithPassword } from "./auth-fixture";
import type {
  AdminInspirationCategorySummary,
  AdminRecipeDetail,
  DiningEventSummary,
  IngredientSummary,
  MealPlanCookAssistant,
  MealPlanSummary,
  MyRecipeDetail,
  PageResult,
  RecipeAssistantSnapshot,
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const memberPhone = process.env.TEST_MEMBER_PHONE ?? "13700000000";
const password = process.env.TEST_USER_PASSWORD ?? "change-me";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";

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
  expiresAt: string;
}

let idempotencySeed = BigInt(Date.now()) * 1000n + BigInt(process.pid % 1000);

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

function createFreshPhone() {
  const suffix = nextIdempotencyKey().slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow: number) {
  const extraDays = Number(nextIdempotencyKey().slice(-2)) % 10;
  return formatDateOnly(new Date(Date.now() + (daysFromNow + extraDays) * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow: number) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function request<T>(path: string, options: RequestInit = {}, admin = false) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(admin
        ? {
            "x-cook-from": "admin_web",
            "x-admin-version": "0.1.0",
            "x-admin-build": "1"
          }
        : {
            "x-cook-from": "mini_program",
            "x-cook-version": "0.1.0"
          }),
      ...options.headers
    }
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, admin = false) {
  const result = await request<T>(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function loginWithCode(phone: string) {
  return loginWithPassword(requestData, phone, password);
}

async function loginAdmin() {
  return requestData<LoginResult>(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: adminUsername,
        password: adminPassword
      })
    },
    true
  );
}

async function resolveRecipeCategory(authHeaders: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: authHeaders
  });
  if (categories.length) return categories[0];

  return requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `做饭助手验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

async function resolveAdminInspirationCategory(adminAuth: Record<string, string>) {
  const categories = await requestData<AdminInspirationCategorySummary[]>("/admin/inspiration-categories", {
    headers: adminAuth
  }, true);
  if (categories.length) return categories[0];

  return requestData<AdminInspirationCategorySummary>(
    "/admin/inspiration-categories",
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        name: `做饭助手系统分类${nextIdempotencyKey().slice(-6)}`
      })
    },
    true
  );
}

async function loadSystemIngredient(authHeaders: Record<string, string>) {
  const result = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  const ingredient = result.items[0];
  assert(ingredient, "missing system ingredient fixture");
  return ingredient;
}

async function createPublishedRecipe(authHeaders: Record<string, string>, titlePrefix: string) {
  const ingredient = await loadSystemIngredient(authHeaders);
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `${titlePrefix}${suffix}`,
        story: "用于做饭助手验收。",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "先看做饭建议，再决定是否切回原步骤。",
        ingredients: [
          {
            ingredientId: ingredient.id,
            name: ingredient.name,
            quantity: "2",
            unitId: ingredient.defaultUnit.id,
            fuzzyText: null,
            categoryId: ingredient.categoryId,
            defaultUnitId: ingredient.defaultUnit.id,
            source: ingredient.source
          }
        ],
        steps: [
          {
            slotKey: "step-1",
            text: "先把食材处理好。",
            uploadId: null,
            imageUrl: null
          },
          {
            slotKey: "step-2",
            text: "开火翻炒后装盘。",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const draftDetail = await requestData<RecipeDraftDetail>(`/recipe-drafts/${draft.id}`, {
    headers: authHeaders
  });
  const published = await requestData<{ recipe: MyRecipeDetail }>(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      expectedVersion: draftDetail.version
    })
  });
  return published.recipe;
}

async function createAdminSystemRecipe(adminAuth: Record<string, string>, inspirationCategoryId: number, ingredient: IngredientSummary) {
  return requestData<AdminRecipeDetail>(
    "/admin/recipes",
    {
      method: "POST",
      headers: withIdempotencyKey(adminAuth),
      body: JSON.stringify({
        inspirationCategoryId,
        coverImageUrl: null,
        coverImageTempKey: null,
        content: {
          name: `做饭助手系统菜谱${nextIdempotencyKey().slice(-6)}`,
          story: "用于验证后台系统菜谱预生成单菜助理。",
          baseServings: 2,
          difficulty: "EASY",
          duration: "WITHIN_15",
          estimatedCalories: null,
          tips: "后台创建后应直接得到单菜做饭建议快照。",
          ingredients: [
            {
              ingredientId: ingredient.id,
              amount: {
                kind: "EXACT",
                quantity: "2",
                unitId: ingredient.defaultUnit.id
              }
            }
          ],
          steps: [
            {
              text: "先把系统菜谱的食材准备好。",
              imageUrl: null,
              imageTempKey: null
            },
            {
              text: "下锅翻炒后装盘。",
              imageUrl: null,
              imageTempKey: null
            }
          ]
        }
      })
    },
    true
  );
}

async function createMealPlan(
  authHeaders: Record<string, string>,
  recipes: MyRecipeDetail[],
  titlePrefix: string,
  daysFromNow: number
) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  return requestData<MealPlanSummary>("/meal-plans", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      planDate: buildPlanDate(daysFromNow),
      mealSlot: "DINNER",
      title: `${titlePrefix}-${titleSuffix}`,
      menuItems: recipes.map((recipe, index) => ({
        slotType: index % 2 === 0 ? "MEAT" : "VEGETABLE",
        sortOrder: index,
        recipeId: recipe.id,
        recipeVersionId: recipe.contentVersionId,
        purchaseState: "READY"
      }))
    })
  });
}

async function createDiningEvent(authHeaders: Record<string, string>, plan: MealPlanSummary, hoursFromNow: number) {
  return requestData<DiningEventSummary>(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(hoursFromNow),
      location: "做饭助手验收饭局"
    })
  });
}

async function main() {
  const paidSession = await loginWithCode(memberPhone);
  const adminSession = await loginAdmin();
  const freeSession = await loginWithCode(createFreshPhone());
  const paidAuth = { authorization: `Bearer ${paidSession.token}` };
  const adminAuth = { authorization: `Bearer ${adminSession.token}` };
  const freeAuth = { authorization: `Bearer ${freeSession.token}` };

  const paidProfile = await requestData<{
    membership: {
      tier: string;
    };
  }>("/users/me", {
    headers: paidAuth
  });
  assert(paidProfile.membership.tier !== "FREE", `paid fixture user should not be FREE, got ${paidProfile.membership.tier}`);

  const adminCategory = await resolveAdminInspirationCategory(adminAuth);
  const systemIngredient = await loadSystemIngredient(paidAuth);
  const adminRecipe = await createAdminSystemRecipe(adminAuth, adminCategory.id, systemIngredient);
  assert(adminRecipe.ownerUid === null, "admin created recipe should be a system recipe");
  assert(adminRecipe.assistantState.status === "READY", "admin created system recipe should finish assistant pre-generation");
  assert(adminRecipe.assistant?.steps.length, "admin created system recipe should return assistant steps");

  const paidGeneratedRecipe = await createPublishedRecipe(paidAuth, "做饭助手会员菜谱");
  const paidRecipeAssistant = await requestData<RecipeAssistantSnapshot>(`/recipes/${paidGeneratedRecipe.id}/assistant`, {
    method: "POST",
    headers: withIdempotencyKey(paidAuth)
  });
  assert(paidRecipeAssistant.steps.length > 0, "paid user recipe should generate assistant steps");

  const paidGeneratedDetail = await requestData<MyRecipeDetail>(`/recipes/${paidGeneratedRecipe.id}`, {
    headers: paidAuth
  });
  assert(paidGeneratedDetail.assistant?.steps.length, "paid generated recipe detail should keep assistant snapshot");

  const freeRecipe = await createPublishedRecipe(freeAuth, "做饭助手免费菜谱");
  const freeRecipeAssistant = await request<unknown>(`/recipes/${freeRecipe.id}/assistant`, {
    method: "POST",
    headers: withIdempotencyKey(freeAuth)
  });
  assert(
    freeRecipeAssistant.status === 200 && freeRecipeAssistant.body.code === 403,
    `free user recipe assistant should return business code 403, got HTTP ${freeRecipeAssistant.status} code ${freeRecipeAssistant.body.code}`
  );
  assert(freeRecipeAssistant.body.message.includes("开通会员"), "free recipe assistant should explain membership gating");

  const paidMissingRecipe = await createPublishedRecipe(paidAuth, "做饭助手待补洞菜谱");
  const paidPlan = await createMealPlan(
    paidAuth,
    [paidGeneratedRecipe, paidMissingRecipe],
    "做饭助手会员本餐",
    12
  );
  const paidEvent = await createDiningEvent(paidAuth, paidPlan, 6);
  const paidPlanAssistant = await requestData<MealPlanCookAssistant>(`/meal-plans/${paidPlan.id}/cook-assistant`, {
    method: "POST",
    headers: withIdempotencyKey(paidAuth)
  });
  assert(paidPlanAssistant.hasSnapshot, "paid meal assistant should generate a snapshot");
  assert(paidPlanAssistant.prepTasks.length > 0, "paid meal assistant should include prep tasks");
  assert(paidPlanAssistant.cookTimeline.length > 0, "paid meal assistant should include cook timeline");
  assert(
    paidPlanAssistant.summary.notes.some(item => item.includes("已为1道缺少建议的菜实时补齐单菜做饭建议")),
    "paid meal assistant should report realtime fill for the missing single-dish assistant"
  );

  const paidPlans = await requestData<PageResult<MealPlanSummary>>(
    `/meal-plans?from=${encodeURIComponent(paidPlan.planDate)}&to=${encodeURIComponent(paidPlan.planDate)}&page=1&pageSize=20`,
    {
      headers: paidAuth
    }
  );
  const paidPlanAfterGenerate = paidPlans.items.find(item => item.id === paidPlan.id) ?? null;
  assert(paidPlanAfterGenerate?.menuLocked, "paid meal assistant generation should lock the menu");

  const paidEventAfterGenerate = await requestData<DiningEventSummary>(`/dining-events/${paidEvent.id}`, {
    headers: paidAuth
  });
  assert(paidEventAfterGenerate.status === "CONFIRMED", "paid meal assistant generation should confirm the linked dining event");

  const paidMissingDetail = await requestData<MyRecipeDetail>(`/recipes/${paidMissingRecipe.id}`, {
    headers: paidAuth
  });
  assert(paidMissingDetail.assistant?.steps.length, "realtime fill should persist the missing recipe assistant snapshot");

  const freePlan = await createMealPlan(freeAuth, [freeRecipe], "做饭助手免费本餐", 13);
  const freePlanAssistant = await request<unknown>(`/meal-plans/${freePlan.id}/cook-assistant`, {
    method: "POST",
    headers: withIdempotencyKey(freeAuth)
  });
  assert(
    freePlanAssistant.status === 200 && freePlanAssistant.body.code === 403,
    `free meal assistant should return business code 403, got HTTP ${freePlanAssistant.status} code ${freePlanAssistant.body.code}`
  );
  assert(freePlanAssistant.body.message.includes("开通会员"), "free meal assistant should explain membership gating");

  const freePlans = await requestData<PageResult<MealPlanSummary>>(
    `/meal-plans?from=${encodeURIComponent(freePlan.planDate)}&to=${encodeURIComponent(freePlan.planDate)}&page=1&pageSize=20`,
    {
      headers: freeAuth
    }
  );
  const freePlanAfterAttempt = freePlans.items.find(item => item.id === freePlan.id) ?? null;
  assert(freePlanAfterAttempt && !freePlanAfterAttempt.menuLocked, "free meal assistant rejection should not lock the menu");

  console.log(
    JSON.stringify(
      {
        ok: true,
        paidTier: paidProfile.membership.tier,
        systemRecipeId: adminRecipe.id,
        paidRecipeId: paidGeneratedRecipe.id,
        paidPlanId: paidPlan.id,
        freePlanId: freePlan.id
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
