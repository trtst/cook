const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("./auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const MEMBER_PHONE = process.env.TEST_MEMBER_PHONE || "13700000000";

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

async function request(path, options = {}) {
  const target = new URL(`${API_BASE_URL}${path}`);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const requestTask = transport.request(
      target,
      {
        method: options.method || "GET",
        headers: {
          "content-type": "application/json",
          "x-cook-from": "mini_program",
          "x-cook-version": "0.1.0",
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

async function requestData(path, options = {}) {
  const result = await request(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
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
      name: `做饭助手页面分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

async function loadSystemIngredient(authHeaders) {
  const result = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  const ingredient = result.items[0];
  assert(ingredient, "missing system ingredient fixture");
  return ingredient;
}

async function createPublishedRecipe(authHeaders, titlePrefix) {
  const ingredient = await loadSystemIngredient(authHeaders);
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `${titlePrefix}${suffix}`,
        story: "用于做饭助手页面自动化。",
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
            text: "先把食材准备好。",
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

async function generateRecipeAssistant(authHeaders, recipeId) {
  return requestData(`/recipes/${recipeId}/assistant`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders)
  });
}

async function createMealPlan(authHeaders, recipes, titlePrefix, daysFromNow) {
  const titleSuffix = nextIdempotencyKey().slice(-6);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(authHeaders),
      body: JSON.stringify({
        planDate: buildPlanDate(daysFromNow + attempt),
        mealSlot: "DINNER",
        title: `${titlePrefix}-${titleSuffix}-${attempt}`,
        menuItems: recipes.map((recipe, index) => ({
          slotType: index % 2 === 0 ? "MEAT" : "VEGETABLE",
          sortOrder: index,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: "READY"
        }))
      })
    });
    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }
    if (result.status !== 409) {
      throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
    }
  }

  throw new Error("failed to create meal assistant fixture plan after retries");
}

async function createDiningEvent(authHeaders, plan, hoursFromNow) {
  return requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(hoursFromNow),
      location: "做饭助手页面验收饭局"
    })
  });
}

async function createMealAssistantFixture() {
  const paidSession = await loginWithPassword(MEMBER_PHONE);
  const freeSession = await loginWithPassword(createFreshPhone());
  const paidAuth = { authorization: `Bearer ${paidSession.token}` };
  const freeAuth = { authorization: `Bearer ${freeSession.token}` };

  const paidProfile = await requestData("/users/me", {
    headers: paidAuth
  });
  assert(paidProfile.membership && paidProfile.membership.tier !== "FREE", "paid fixture user should expose paid membership tier");

  const freeProfile = await requestData("/users/me", {
    headers: freeAuth
  });
  assert(freeProfile.membership && freeProfile.membership.tier === "FREE", "fresh fixture user should stay FREE");

  const paidGeneratedRecipe = await createPublishedRecipe(paidAuth, "做饭助手会员菜谱");
  await generateRecipeAssistant(paidAuth, paidGeneratedRecipe.id);
  const paidMissingRecipe = await createPublishedRecipe(paidAuth, "做饭助手待补洞菜谱");
  const freeRecipe = await createPublishedRecipe(freeAuth, "做饭助手免费菜谱");

  const plan = await createMealPlan(
    paidAuth,
    [paidGeneratedRecipe, paidMissingRecipe],
    "做饭助手页面本餐",
    14
  );
  const event = await createDiningEvent(paidAuth, plan, 6);

  return {
    paidSession,
    paidProfile,
    freeSession,
    freeProfile,
    paidGeneratedRecipe,
    paidMissingRecipe,
    freeRecipe,
    plan,
    event
  };
}

module.exports = {
  createMealAssistantFixture
};
