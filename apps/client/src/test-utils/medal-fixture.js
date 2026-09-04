const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("./auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";

let idempotencySeed = Date.now();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function withIdempotencyKey(headers, key = nextIdempotencyKey()) {
  return {
    ...headers,
    "Idempotency-Key": key
  };
}

function createFreshPhone() {
  const suffix = `${Date.now()}${nextIdempotencyKey()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

async function request(path, options = {}, admin = false) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
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
          ...(options.headers || {})
        }
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode || 0,
              body: JSON.parse(rawBody || "null")
            });
          } catch (error) {
            reject(new Error(`invalid json response from ${path}: ${rawBody}`));
          }
        });
      }
    );

    requestTask.on("error", reject);

    if (options.body) {
      requestTask.write(options.body);
    }

    requestTask.end();
  });
}

async function requestData(path, options = {}, admin = false) {
  const result = await request(path, options, admin);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function loginAdmin() {
  const result = await requestData(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD
      })
    },
    true
  );
  return result.token;
}

async function createMedalTemplate(adminToken, payload) {
  return requestData(
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
        targetCount: payload.targetCount || 1,
        sortOrder: payload.sortOrder || 0,
        isLimited: false,
        startAt: null,
        endAt: null
      })
    },
    true
  );
}

async function resolveRecipeCategory(authHeaders) {
  const categories = await requestData("/recipe-categories", {
    headers: authHeaders
  });
  if (categories.length) return categories[0];

  return requestData("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `勋章自动化分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow) {
  const extraDays = Number(nextIdempotencyKey().slice(-2)) % 10;
  return formatDateOnly(new Date(Date.now() + (daysFromNow + extraDays) * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function parseShareToken(shareTokenPath) {
  const url = new URL(shareTokenPath, "https://cook.local");
  const token = url.searchParams.get("token");
  assert(token, "share token should exist in shareTokenPath");
  return token;
}

async function createOwnerRecipe(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  const ingredient = ingredients.items[0];
  assert(ingredient, "missing system ingredient fixture");

  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `勋章自动化菜谱${suffix}`,
        story: "用于勋章墙页面自动化。",
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
            text: "勋章自动化步骤",
            uploadId: null,
            imageUrl: null
          }
        ]
      }
    })
  });
  const draftDetail = await requestData(`/recipe-drafts/${draft.id}`, {
    headers: authHeaders
  });
  const published = await requestData(`/recipe-drafts/${draft.id}/publish`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      expectedVersion: draftDetail.version
    })
  });
  return published.recipe;
}

async function createMealPlan(authHeaders, recipe) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(authHeaders),
      body: JSON.stringify({
        planDate: buildPlanDate(26 + attempt),
        mealSlot: "DINNER",
        title: `勋章自动化餐次-${titleSuffix}-${attempt}`,
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

async function createDiningEvent(authHeaders, planId) {
  return requestData(`/meal-plans/${planId}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(2),
      location: "勋章自动化饭局"
    })
  });
}

async function addEventGapAndCheck(authHeaders, eventId) {
  const list = await requestData("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `勋章自动化清单-${nextIdempotencyKey().slice(-6)}`
    })
  });
  const detail = await requestData(`/shopping-lists/${list.id}/items/from-event-gap`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      eventId
    })
  });
  const eventItem = detail.items.find((item) => item.sources.some((source) => source.sourceType === "EVENT"));
  assert(eventItem, "event shopping list should contain EVENT source");

  return requestData(`/shopping-lists/${detail.id}/check-all`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      version: detail.version
    })
  });
}

async function createShareAndJoin(ownerAuth, memberAuth, eventId, memberUid) {
  const shareLink = await requestData(`/dining-events/${eventId}/share-link`, {
    method: "POST",
    headers: withIdempotencyKey(ownerAuth),
    body: JSON.stringify({})
  });
  const shareToken = parseShareToken(shareLink.shareTokenPath);
  const joined = await requestData(`/share/${shareToken}/accept`, {
    method: "POST",
    headers: withIdempotencyKey(memberAuth),
    body: JSON.stringify({
      guestName: "勋章自动化成员"
    })
  });
  const participant = joined.participants.find((item) => item.userUid === memberUid);
  assert(participant && participant.status === "ACCEPTED", "member should join the event as ACCEPTED");
}

async function completeDiningEvent(authHeaders, eventId) {
  return requestData(`/dining-events/${eventId}/complete`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({})
  });
}

async function completeMealPlan(authHeaders, planId) {
  return requestData(`/meal-plans/${planId}/complete`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({})
  });
}

async function getCurrentMedals(token) {
  return requestData("/users/me/medals", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
}

async function createMedalFixture() {
  const adminToken = await loginAdmin();
  const suffix = nextIdempotencyKey().slice(-6);

  const templates = {
    meal: await createMedalTemplate(adminToken, {
      awardRule: "MEAL_COMPLETION",
      category: "MEAL_CHECKIN",
      name: `勋章墙餐次${suffix}`,
      description: "完成一顿饭后自动点亮。",
      condition: "真实完成 1 次餐次",
      status: "LISTED",
      sortOrder: 11
    }),
    event: await createMedalTemplate(adminToken, {
      awardRule: "DINING_EVENT_COMPLETION",
      category: "DINING_COLLABORATION",
      name: `勋章墙饭局${suffix}`,
      description: "完成一场饭局后自动点亮。",
      condition: "真实完成 1 场饭局",
      status: "LISTED",
      sortOrder: 12
    }),
    group: await createMedalTemplate(adminToken, {
      awardRule: "GROUP_MEAL_COMPLETION",
      category: "DINING_COLLABORATION",
      name: `勋章墙多人饭局${suffix}`,
      description: "至少一位参与人接受后完成饭局自动点亮。",
      condition: "真实完成 1 场多人饭局",
      status: "LISTED",
      sortOrder: 13
    }),
    fullLoop: await createMedalTemplate(adminToken, {
      awardRule: "FULL_LOOP_COMPLETION",
      category: "MEAL_CHECKIN",
      name: `勋章墙完整闭环${suffix}`,
      description: "走完采购并完成用餐后自动点亮。",
      condition: "真实走完 1 次饭局采购闭环",
      status: "LISTED",
      sortOrder: 14
    }),
    locked: await createMedalTemplate(adminToken, {
      awardRule: "RECOMMENDATION_ADOPTED_TOTAL",
      category: "HOLIDAY_LIMITED",
      name: `勋章墙待点亮${suffix}`,
      description: "用于展示未获得灰态勋章。",
      condition: "真实推荐收录 1 次",
      status: "LISTED",
      sortOrder: 15
    }),
    hidden: await createMedalTemplate(adminToken, {
      awardRule: "RECOMMENDATION_ADOPTED_TOTAL",
      category: "RECOMMENDATION_CONTRIBUTION",
      name: `勋章墙隐藏${suffix}`,
      description: "用于验证未获得且已下架模板不会显示。",
      condition: "真实推荐收录 2 次",
      status: "UNLISTED",
      targetCount: 2,
      sortOrder: 16
    })
  };

  const ownerPhone = createFreshPhone();
  const memberPhone = createFreshPhone();
  const ownerSession = await loginWithPassword(ownerPhone);
  const memberSession = await loginWithPassword(memberPhone);
  const ownerAuth = {
    authorization: `Bearer ${ownerSession.token}`
  };
  const memberAuth = {
    authorization: `Bearer ${memberSession.token}`
  };

  const recipe = await createOwnerRecipe(ownerAuth);
  const plan = await createMealPlan(ownerAuth, recipe);
  const event = await createDiningEvent(ownerAuth, plan.id);
  await createShareAndJoin(ownerAuth, memberAuth, event.id, memberSession.user.uid);
  await addEventGapAndCheck(ownerAuth, event.id);
  await completeDiningEvent(ownerAuth, event.id);
  await completeMealPlan(ownerAuth, plan.id);

  const ownerWall = await getCurrentMedals(ownerSession.token);
  return {
    ownerSession,
    memberSession,
    ownerPhone,
    memberPhone,
    planId: plan.id,
    eventId: event.id,
    ownerWall,
    templates: {
      meal: { code: templates.meal.code, name: templates.meal.name, condition: templates.meal.condition, categoryName: "开饭打卡" },
      event: { code: templates.event.code, name: templates.event.name, condition: templates.event.condition, categoryName: "饭局协作" },
      group: { code: templates.group.code, name: templates.group.name, condition: templates.group.condition, categoryName: "饭局协作" },
      fullLoop: { code: templates.fullLoop.code, name: templates.fullLoop.name, condition: templates.fullLoop.condition, categoryName: "开饭打卡" },
      locked: { code: templates.locked.code, name: templates.locked.name, condition: templates.locked.condition, categoryName: "节假日限定" },
      hidden: { code: templates.hidden.code, name: templates.hidden.name, condition: templates.hidden.condition, categoryName: "推荐贡献" }
    }
  };
}

module.exports = {
  API_BASE_URL,
  assert,
  createMedalFixture
};
