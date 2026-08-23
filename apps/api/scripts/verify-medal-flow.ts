import { loadLocalEnv } from "../src/common/load-env";
import type {
  AdminMedalTemplateSummary,
  DiningEventShareLinkResponse,
  DiningEventSummary,
  IngredientSummary,
  MedalWallResponse,
  MealPlanSummary,
  MyRecipeDetail,
  PageResult,
  RecipeCategorySummary,
  RecipeDraftDetail,
  SaveRecipeDraftResponse,
  ShoppingListDetail
} from "../src/contracts/types";

loadLocalEnv();

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3100/api";
const adminUsername = process.env.ADMIN_SEED_USERNAME ?? "admin";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "change-me";
const testCode = "123456";
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9s8AAAAASUVORK5CYII=",
  "base64"
);

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface AdminLoginResult {
  token: string;
}

interface LoginResult {
  token: string;
  expiresAt: string;
  user: {
    uid: number;
  };
}

let idempotencySeed =
  BigInt(Date.now()) * 1_000_000n +
  BigInt(process.pid % 1000) * 1_000n +
  BigInt(Math.floor(Math.random() * 1000));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1n;
  return idempotencySeed.toString();
}

function createFreshPhone() {
  const suffix = nextIdempotencyKey().slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function buildHeaders(admin = false, extra: Record<string, string> = {}, includeJsonContentType = true) {
  return admin
    ? {
        ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
        "x-cook-from": "admin_web",
        "x-admin-version": "0.1.0",
        "x-admin-build": "1",
        ...extra
      }
    : {
        ...(includeJsonContentType ? { "content-type": "application/json" } : {}),
        "x-cook-from": "mini_program",
        "x-cook-version": "0.1.0",
        ...extra
      };
}

async function request<T>(path: string, options: RequestInit = {}, admin = false, includeJsonContentType = true) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: buildHeaders(admin, options.headers as Record<string, string> | undefined, includeJsonContentType)
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status, body };
}

async function requestData<T>(path: string, options: RequestInit = {}, admin = false, includeJsonContentType = true) {
  const result = await request<T>(path, options, admin, includeJsonContentType);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

function withIdempotencyKey(headers: Record<string, string>, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

async function loginAdmin() {
  return requestData<AdminLoginResult>(
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

async function loginWithCode(phone: string) {
  return requestData<LoginResult>("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: testCode
    })
  });
}

async function listMedalTemplates(adminToken: string, keyword?: string) {
  const query = keyword ? `?page=1&pageSize=100&keyword=${encodeURIComponent(keyword)}` : "?page=1&pageSize=100";
  return requestData<PageResult<AdminMedalTemplateSummary>>(
    `/admin/medal-templates${query}`,
    {
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    },
    true
  );
}

async function createMedalTemplate(
  adminToken: string,
  payload: {
    awardRule: AdminMedalTemplateSummary["awardRule"];
    category: AdminMedalTemplateSummary["category"];
    name: string;
    description: string;
    condition: string;
    status: "DRAFT" | "LISTED" | "UNLISTED";
    targetCount?: number;
    sortOrder?: number;
    isLimited?: boolean;
    startAt?: string | null;
    endAt?: string | null;
  }
) {
  return requestData<AdminMedalTemplateSummary>(
    "/admin/medal-templates",
    {
      method: "POST",
      headers: withIdempotencyKey({
        authorization: `Bearer ${adminToken}`
      }),
      body: JSON.stringify({
        awardRule: payload.awardRule,
        category: payload.category,
        name: payload.name,
        description: payload.description,
        condition: payload.condition,
        status: payload.status,
        targetCount: payload.targetCount ?? 1,
        sortOrder: payload.sortOrder ?? 0,
        isLimited: payload.isLimited ?? false,
        startAt: payload.startAt ?? null,
        endAt: payload.endAt ?? null
      })
    },
    true
  );
}

async function updateMedalTemplate(
  adminToken: string,
  template: AdminMedalTemplateSummary,
  payload: {
    category: AdminMedalTemplateSummary["category"];
    name: string;
    description: string;
    condition: string;
    targetCount?: number;
    sortOrder?: number;
    isLimited?: boolean;
    startAt?: string | null;
    endAt?: string | null;
  }
) {
  return requestData<AdminMedalTemplateSummary>(
    `/admin/medal-templates/${template.id}`,
    {
      method: "PUT",
      headers: withIdempotencyKey({
        authorization: `Bearer ${adminToken}`
      }),
      body: JSON.stringify({
        expectedVersion: template.version,
        category: payload.category,
        name: payload.name,
        description: payload.description,
        condition: payload.condition,
        targetCount: payload.targetCount ?? template.targetCount,
        sortOrder: payload.sortOrder ?? template.sortOrder,
        isLimited: payload.isLimited ?? template.isLimited,
        startAt: payload.startAt ?? template.startAt,
        endAt: payload.endAt ?? template.endAt
      })
    },
    true
  );
}

async function setMedalTemplateStatus(
  adminToken: string,
  template: AdminMedalTemplateSummary,
  status: AdminMedalTemplateSummary["status"]
) {
  return requestData<AdminMedalTemplateSummary>(
    `/admin/medal-templates/${template.id}/status`,
    {
      method: "POST",
      headers: withIdempotencyKey({
        authorization: `Bearer ${adminToken}`
      }),
      body: JSON.stringify({
        expectedVersion: template.version,
        status
      })
    },
    true
  );
}

async function uploadMedalImage(
  adminToken: string,
  template: AdminMedalTemplateSummary,
  imageType: "earned" | "locked"
) {
  const formData = new FormData();
  formData.append("expectedVersion", String(template.version));
  formData.append("file", new Blob([pngBytes], { type: "image/png" }), `medal-${imageType}.png`);

  return requestData<AdminMedalTemplateSummary>(
    `/admin/medal-templates/${template.id}/image/${imageType}`,
    {
      method: "POST",
      headers: withIdempotencyKey({
        authorization: `Bearer ${adminToken}`
      }),
      body: formData
    },
    true,
    false
  );
}

async function clearMedalImage(
  adminToken: string,
  template: AdminMedalTemplateSummary,
  imageType: "earned" | "locked"
) {
  return requestData<AdminMedalTemplateSummary>(
    `/admin/medal-templates/${template.id}/image/${imageType}`,
    {
      method: "DELETE",
      headers: withIdempotencyKey({
        authorization: `Bearer ${adminToken}`
      }),
      body: JSON.stringify({
        expectedVersion: template.version
      })
    },
    true
  );
}

async function getCurrentMedals(token?: string) {
  const result = await request<MedalWallResponse>(
    "/users/me/medals",
    {
      headers: token
        ? {
            authorization: `Bearer ${token}`
          }
        : {}
    }
  );
  return result;
}

async function resolveRecipeCategory(ownerAuth: Record<string, string>) {
  const categories = await requestData<RecipeCategorySummary[]>("/recipe-categories", {
    headers: ownerAuth
  });
  if (categories.length) return categories[0];

  return requestData<RecipeCategorySummary>("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: `勋章验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
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

function parseShareToken(shareTokenPath: string) {
  const url = new URL(shareTokenPath, "https://cook.local");
  const token = url.searchParams.get("token");
  assert(token, "share token should exist in shareTokenPath");
  return token;
}

async function createOwnerRecipe(ownerAuth: Record<string, string>) {
  const systemIngredients = await requestData<PageResult<IngredientSummary>>("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: ownerAuth
  });
  const ingredient = systemIngredients.items[0];
  assert(ingredient, "system ingredient should exist");

  const category = await resolveRecipeCategory(ownerAuth);
  const suffix = nextIdempotencyKey().slice(-6);
  const draft = await requestData<SaveRecipeDraftResponse>("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `勋章验收菜谱${suffix}`,
        story: "用于验证勋章自动点亮。",
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
            text: "勋章验收步骤",
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
    body: JSON.stringify({
      expectedVersion: draftDetail.version
    })
  });

  return published.recipe;
}

async function createMealPlan(ownerAuth: Record<string, string>, recipe: MyRecipeDetail) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request<MealPlanSummary>("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(ownerAuth),
      body: JSON.stringify({
        planDate: buildPlanDate(25 + attempt),
        mealSlot: "DINNER",
        title: `勋章验收餐次-${titleSuffix}-${attempt}`,
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
    if (result.status === 409 && result.body.message.includes("计划已存在")) {
      continue;
    }
    throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
  }
  throw new Error("/meal-plans failed after 10 attempts due to existing plan conflicts");
}

async function createDiningEvent(ownerAuth: Record<string, string>, planId: number) {
  return requestData<DiningEventSummary>(`/meal-plans/${planId}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(2),
      location: "勋章验收饭局"
    })
  });
}

async function createEventGapShopping(ownerAuth: Record<string, string>, eventId: number) {
  const list = await requestData<ShoppingListDetail>("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      name: `勋章验收清单-${nextIdempotencyKey().slice(-6)}`
    })
  });
  const detailed = await requestData<ShoppingListDetail>(`/shopping-lists/${list.id}/items/from-event-gap`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      eventId
    })
  });
  const eventItem = detailed.items.find(item => item.sources.some(source => source.sourceType === "EVENT"));
  assert(eventItem, "event shopping list should contain EVENT source item");

  const checkedAll = await requestData<ShoppingListDetail>(`/shopping-lists/${detailed.id}/check-all`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({
      version: detailed.version
    })
  });
  return {
    listId: detailed.id,
    itemId: eventItem.id,
    sourceTypes: eventItem.sources.map(source => source.sourceType),
    version: checkedAll.version
  };
}

async function createShareAndJoin(ownerAuth: Record<string, string>, memberAuth: Record<string, string>, eventId: number, memberUid: number) {
  const shareLink = await requestData<DiningEventShareLinkResponse>(`/dining-events/${eventId}/share-link`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({})
  });
  const shareToken = parseShareToken(shareLink.shareTokenPath);
  const joined = await requestData<DiningEventSummary>(`/share/${shareToken}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      guestName: "勋章验收成员"
    })
  });
  const participant = joined.participants.find(item => item.userUid === memberUid);
  assert(participant?.status === "ACCEPTED", "member should join the event as ACCEPTED");
  return shareLink.shareTokenPath;
}

async function completeDiningEvent(ownerAuth: Record<string, string>, eventId: number) {
  return requestData<DiningEventSummary>(`/dining-events/${eventId}/complete`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({})
  });
}

async function completeMealPlan(ownerAuth: Record<string, string>, planId: number) {
  return requestData<MealPlanSummary>(`/meal-plans/${planId}/complete`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({})
  });
}

function findWallItem(wall: MedalWallResponse, code: string) {
  return wall.items.find(item => item.code === code) ?? null;
}

async function main() {
  const unauthenticatedMedals = await getCurrentMedals();
  assert(unauthenticatedMedals.status === 401, "unauthenticated /users/me/medals should return 401");

  const adminSession = await loginAdmin();
  const listBefore = await listMedalTemplates(adminSession.token);

  const suffix = nextIdempotencyKey().slice(-6);
  let mealTemplate = await createMedalTemplate(adminSession.token, {
    awardRule: "MEAL_COMPLETION",
    category: "MEAL_CHECKIN",
    name: `勋章联调餐次${suffix}`,
    description: "完成一顿饭后自动点亮。",
    condition: "真实完成 1 次餐次",
    status: "DRAFT",
    targetCount: 1,
    sortOrder: 10
  });
  const mealUploaded = await uploadMedalImage(adminSession.token, mealTemplate, "earned");
  assert(Boolean(mealUploaded.earnedImageUrl), "earned medal image should be uploaded");
  const mealCleared = await clearMedalImage(adminSession.token, mealUploaded, "earned");
  assert(mealCleared.earnedImageUrl === null, "earned medal image should be cleared");
  mealTemplate = await updateMedalTemplate(adminSession.token, mealCleared, {
    category: "MEAL_CHECKIN",
    name: `勋章联调餐次已上架${suffix}`,
    description: "完成一顿饭后自动点亮。",
    condition: "真实完成 1 次餐次",
    targetCount: 1,
    sortOrder: 10
  });
  mealTemplate = await setMedalTemplateStatus(adminSession.token, mealTemplate, "LISTED");

  const eventTemplate = await createMedalTemplate(adminSession.token, {
    awardRule: "DINING_EVENT_COMPLETION",
    category: "DINING_COLLABORATION",
    name: `勋章联调饭局${suffix}`,
    description: "完成一场饭局后自动点亮。",
    condition: "真实完成 1 场饭局",
    status: "LISTED",
    targetCount: 1,
    sortOrder: 11
  });
  const groupTemplate = await createMedalTemplate(adminSession.token, {
    awardRule: "GROUP_MEAL_COMPLETION",
    category: "DINING_COLLABORATION",
    name: `勋章联调多人饭局${suffix}`,
    description: "至少一位参与人接受后完成饭局自动点亮。",
    condition: "真实完成 1 场多人饭局",
    status: "LISTED",
    targetCount: 1,
    sortOrder: 12
  });
  const fullLoopTemplate = await createMedalTemplate(adminSession.token, {
    awardRule: "FULL_LOOP_COMPLETION",
    category: "MEAL_CHECKIN",
    name: `勋章联调完整闭环${suffix}`,
    description: "饭局缺口采购后完成用餐自动点亮。",
    condition: "真实走完 1 次饭局采购闭环",
    status: "LISTED",
    targetCount: 1,
    sortOrder: 13
  });
  const hiddenTemplate = await createMedalTemplate(adminSession.token, {
    awardRule: "RECOMMENDATION_ADOPTED_TOTAL",
    category: "RECOMMENDATION_CONTRIBUTION",
    name: `勋章联调隐藏模板${suffix}`,
    description: "用于验证未获得且已下架模板不会出现在勋章墙。",
    condition: "真实推荐收录 1 次",
    status: "UNLISTED",
    targetCount: 1,
    sortOrder: 14
  });

  const listAfter = await listMedalTemplates(adminSession.token);
  const createdTemplateIds = [mealTemplate.id, eventTemplate.id, groupTemplate.id, fullLoopTemplate.id, hiddenTemplate.id];
  assert(
    createdTemplateIds.every(templateId => listAfter.items.some(item => item.id === templateId)),
    "created medal templates should be readable from admin list"
  );

  const ownerPhone = createFreshPhone();
  const memberPhone = createFreshPhone();
  const viewerPhone = createFreshPhone();
  const owner = await loginWithCode(ownerPhone);
  const member = await loginWithCode(memberPhone);
  const viewer = await loginWithCode(viewerPhone);
  const ownerAuth = { authorization: `Bearer ${owner.token}` };
  const memberAuth = { authorization: `Bearer ${member.token}` };

  const ownerWallBeforeResult = await getCurrentMedals(owner.token);
  assert(ownerWallBeforeResult.status === 200, "owner wall should be readable before earning");
  const ownerWallBefore = ownerWallBeforeResult.body.data;
  assert(findWallItem(ownerWallBefore, mealTemplate.code)?.earned === false, "meal template should be visible and locked before completion");
  assert(findWallItem(ownerWallBefore, eventTemplate.code)?.earned === false, "event template should be visible and locked before completion");
  assert(findWallItem(ownerWallBefore, groupTemplate.code)?.earned === false, "group template should be visible and locked before completion");
  assert(findWallItem(ownerWallBefore, fullLoopTemplate.code)?.earned === false, "full-loop template should be visible and locked before completion");
  assert(findWallItem(ownerWallBefore, hiddenTemplate.code) === null, "unlisted unearned template should stay hidden");

  const viewerWallResult = await getCurrentMedals(viewer.token);
  assert(viewerWallResult.status === 200, "viewer wall should be readable");
  assert(findWallItem(viewerWallResult.body.data, hiddenTemplate.code) === null, "fresh viewer should not see hidden template");

  const recipe = await createOwnerRecipe(ownerAuth);
  const plan = await createMealPlan(ownerAuth, recipe);
  const event = await createDiningEvent(ownerAuth, plan.id);
  const shareTokenPath = await createShareAndJoin(ownerAuth, memberAuth, event.id, member.user.uid);
  const shopping = await createEventGapShopping(ownerAuth, event.id);
  const completedEvent = await completeDiningEvent(ownerAuth, event.id);
  assert(completedEvent.status === "COMPLETED", "dining event should become COMPLETED");
  const completedPlan = await completeMealPlan(ownerAuth, plan.id);
  assert(completedPlan.status === "COMPLETED", "meal plan should become COMPLETED");

  const ownerWallAfterResult = await getCurrentMedals(owner.token);
  assert(ownerWallAfterResult.status === 200, "owner wall should be readable after earning");
  const ownerWallAfter = ownerWallAfterResult.body.data;
  assert(findWallItem(ownerWallAfter, mealTemplate.code)?.earned === true, "owner should earn meal completion medal");
  assert(findWallItem(ownerWallAfter, eventTemplate.code)?.earned === true, "owner should earn dining event medal");
  assert(findWallItem(ownerWallAfter, groupTemplate.code)?.earned === true, "owner should earn group dining medal");
  assert(findWallItem(ownerWallAfter, fullLoopTemplate.code)?.earned === true, "owner should earn full loop medal");
  assert(findWallItem(ownerWallAfter, hiddenTemplate.code) === null, "hidden template should remain invisible when unearned");

  const memberWallAfterResult = await getCurrentMedals(member.token);
  assert(memberWallAfterResult.status === 200, "member wall should be readable after event completion");
  const memberWallAfter = memberWallAfterResult.body.data;
  assert(findWallItem(memberWallAfter, eventTemplate.code)?.earned === true, "accepted member should earn dining event medal");
  assert(findWallItem(memberWallAfter, groupTemplate.code)?.earned === false, "accepted member should not earn owner-only group medal");
  assert(findWallItem(memberWallAfter, mealTemplate.code)?.earned === false, "accepted member should not earn owner meal medal");
  assert(findWallItem(memberWallAfter, fullLoopTemplate.code)?.earned === false, "accepted member should not earn owner full-loop medal");

  console.log(
    JSON.stringify(
      {
        apiBaseUrl,
        adminTemplateTotalBefore: listBefore.total,
        adminTemplateTotalAfterList: listAfter.total,
        createdTemplateCodes: {
          meal: mealTemplate.code,
          event: eventTemplate.code,
          group: groupTemplate.code,
          fullLoop: fullLoopTemplate.code,
          hidden: hiddenTemplate.code
        },
        owner: {
          phone: ownerPhone,
          uid: owner.user.uid,
          earnedCountBefore: ownerWallBefore.earnedCount,
          earnedCountAfter: ownerWallAfter.earnedCount
        },
        member: {
          phone: memberPhone,
          uid: member.user.uid,
          earnedCountAfter: memberWallAfter.earnedCount
        },
        viewerPhone,
        planItemId: plan.id,
        eventId: event.id,
        shoppingListId: shopping.listId,
        shoppingItemId: shopping.itemId,
        shoppingSourceTypes: shopping.sourceTypes,
        shareTokenPath
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
