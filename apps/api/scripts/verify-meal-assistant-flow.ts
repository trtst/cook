import { Prisma, PrismaClient } from "@prisma/client";
import { loadLocalEnv } from "../src/common/load-env";
import { candidateReadiness } from "./backfill-recipe-wiki-readiness";
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
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse
} from "../src/contracts/types";

loadLocalEnv();

const prisma = new PrismaClient();
const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
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
          tips: "后台创建后只登记做饭助手候选，完成验证后才可前台使用。",
          keywords: [],
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
              text: "先把系统菜谱的食材准备好，约 5 分钟。",
              imageUrl: null,
              imageTempKey: null
            },
            {
              text: "下锅翻炒 6 分钟后装盘。",
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

async function publishReadyWikiFromCandidate(recipeVersionId: number) {
  const assistant = await prisma.recipeCookAssistant.findUnique({
    where: { recipeVersionId }
  });
  assert(assistant?.status === "NEEDS_REVIEW", "admin created system recipe should create a Wiki candidate awaiting review");
  assert(assistant.candidateJson !== null, "admin created system recipe should store a Wiki candidate");

  const readiness = candidateReadiness(assistant.candidateJson);
  assert(readiness.status === "READY" && readiness.snapshotJson, `Wiki candidate should pass deterministic readiness: ${JSON.stringify(readiness.blockingReasons)}`);
  const now = new Date();
  await prisma.recipeCookAssistant.update({
    where: { recipeVersionId },
    data: {
      status: "READY",
      snapshotJson: readiness.snapshotJson as Prisma.InputJsonValue,
      generatedAt: now,
      lastAttemptAt: now,
      lastError: null
    }
  });
}

async function createMealPlan(
  authHeaders: Record<string, string>,
  recipes: Array<{ id: number; contentVersionId: number }>,
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
  const paidSession = await loginWithCode(createFreshPhone());
  const adminSession = await loginAdmin();
  const freeSession = await loginWithCode(createFreshPhone());
  const paidAuth = { authorization: `Bearer ${paidSession.token}` };
  const adminAuth = { authorization: `Bearer ${adminSession.token}` };
  const freeAuth = { authorization: `Bearer ${freeSession.token}` };

  const adminCategory = await resolveAdminInspirationCategory(adminAuth);
  const systemIngredient = await loadSystemIngredient(paidAuth);
  const adminRecipe = await createAdminSystemRecipe(adminAuth, adminCategory.id, systemIngredient);
  assert(adminRecipe.inspirationCategory?.id === adminCategory.id, "admin created recipe should be a system inspiration recipe");
  assert(adminRecipe.assistantState.status === "NEEDS_REVIEW", "admin created system recipe should not publish a frontend Wiki before readiness");
  await publishReadyWikiFromCandidate(adminRecipe.contentVersionId);

  const recipeAssistantLocked = await requestData<MealPlanCookAssistant>(`/recipe-versions/${adminRecipe.contentVersionId}/cook-assistant`, {
    headers: paidAuth
  });
  assert(recipeAssistantLocked.status === "READY", "READY system recipe Wiki should expose single assistant status");
  assert(!recipeAssistantLocked.unlocked && recipeAssistantLocked.assistant === null, "single assistant should hide body before personal unlock");

  const recipeAssistantUnlocked = await requestData<MealPlanCookAssistant>(`/recipe-versions/${adminRecipe.contentVersionId}/cook-assistant/unlock`, {
    method: "POST",
    headers: withIdempotencyKey(paidAuth)
  });
  assert(recipeAssistantUnlocked.unlocked, "single assistant unlock should mark current user unlocked");
  assert(recipeAssistantUnlocked.assistant?.steps.length, "single assistant unlock should return Wiki steps");

  const paidGeneratedRecipe = await createPublishedRecipe(paidAuth, "做饭助手用户菜谱");
  const paidGeneratedDetail = await requestData<MyRecipeDetail>(`/recipes/${paidGeneratedRecipe.id}`, {
    headers: paidAuth
  });
  assert(paidGeneratedDetail.assistantAvailable === false, "newly published user recipe should not expose an assistant before Wiki is READY");
  assert(!("assistant" in paidGeneratedDetail), "ordinary recipe detail should not include Wiki assistant JSON");

  const freeRecipe = await createPublishedRecipe(freeAuth, "做饭助手免费菜谱");
  const freeGeneratedDetail = await requestData<MyRecipeDetail>(`/recipes/${freeRecipe.id}`, {
    headers: freeAuth
  });
  assert(freeGeneratedDetail.assistantAvailable === false, "free user recipe without READY Wiki should not expose an assistant");

  const paidMissingRecipe = await createPublishedRecipe(paidAuth, "做饭助手待补洞菜谱");
  const paidPlan = await createMealPlan(
    paidAuth,
    [adminRecipe, paidMissingRecipe],
    "做饭助手会员本餐",
    12
  );
  const paidEvent = await createDiningEvent(paidAuth, paidPlan, 6);
  const rawContext = await requestData<{ dishes: Array<{ content: { steps: unknown[] } }> }>(`/meal-plans/${paidPlan.id}/cook-context`, {
    headers: paidAuth
  });
  assert(rawContext.dishes.length === 2 && rawContext.dishes.every(item => item.content.steps.length > 0), "meal cook context should return raw steps for each dish");

  const paidPlanBeforeUnlock = await requestData<MealPlanCookAssistant>(`/meal-plans/${paidPlan.id}/cook-assistant`, {
    headers: paidAuth
  });
  assert(paidPlanBeforeUnlock.status === "NOT_GENERATED" && paidPlanBeforeUnlock.assistant === null, "meal assistant should start as not generated");

  const paidPlanAssistant = await requestData<MealPlanCookAssistant & { newlyUnlocked: boolean }>(`/meal-plans/${paidPlan.id}/cook-assistant/unlock`, {
    method: "POST",
    headers: withIdempotencyKey(paidAuth)
  });
  assert(paidPlanAssistant.status === "READY" && paidPlanAssistant.newlyUnlocked, "meal assistant unlock should generate and unlock once");
  assert(paidPlanAssistant.assistant?.steps.length, "meal assistant unlock should return planned steps");
  assert(paidPlanAssistant.assistant.dishes.some(item => item.source === "ORIGINAL"), "partial missing Wiki should be frozen as ORIGINAL source");

  const paidPlans = await requestData<PageResult<MealPlanSummary>>(
    `/meal-plans?from=${encodeURIComponent(paidPlan.planDate)}&to=${encodeURIComponent(paidPlan.planDate)}&page=1&pageSize=20`,
    {
      headers: paidAuth
    }
  );
  const paidPlanAfterGenerate = paidPlans.items.find(item => item.id === paidPlan.id) ?? null;
  assert(paidPlanAfterGenerate, "meal assistant plan should remain readable after unlock");

  const paidEventAfterGenerate = await requestData<DiningEventSummary>(`/dining-events/${paidEvent.id}`, {
    headers: paidAuth
  });
  assert(paidEventAfterGenerate.id === paidEvent.id, "linked dining event should remain readable after assistant unlock");

  const freePlan = await createMealPlan(freeAuth, [freeRecipe], "做饭助手免费本餐", 13);
  const freePlanAssistant = await request<unknown>(`/meal-plans/${freePlan.id}/cook-assistant/unlock`, {
    method: "POST",
    headers: withIdempotencyKey(freeAuth)
  });
  assert(
    freePlanAssistant.status === 200 && freePlanAssistant.body.code === 409,
    `meal assistant with no READY Wiki should return business code 409, got HTTP ${freePlanAssistant.status} code ${freePlanAssistant.body.code}`
  );

  const freePlans = await requestData<PageResult<MealPlanSummary>>(
    `/meal-plans?from=${encodeURIComponent(freePlan.planDate)}&to=${encodeURIComponent(freePlan.planDate)}&page=1&pageSize=20`,
    {
      headers: freeAuth
    }
  );
  const freePlanAfterAttempt = freePlans.items.find(item => item.id === freePlan.id) ?? null;
  assert(freePlanAfterAttempt && !freePlanAfterAttempt.menuLocked, "all-missing-Wiki meal assistant rejection should not lock the menu");

  console.log(
    JSON.stringify(
      {
        ok: true,
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
}).finally(async () => {
  await prisma.$disconnect();
});
