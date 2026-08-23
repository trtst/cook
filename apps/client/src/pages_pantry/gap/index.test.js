const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_CODE = "123456";

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function collectTexts(page) {
  const nodes = await page.$$("text");
  const texts = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) texts.push(value);
  }

  return texts;
}

function hasNormalizedText(texts, expected) {
  const normalizedExpected = expected.replace(/\s+/g, "");
  return texts.some((item) => item.replace(/\s+/g, "") === normalizedExpected);
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

let idempotencySeed = Date.now();

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
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFutureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildPlanDate(daysFromNow) {
  return formatDateOnly(new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000));
}

async function loginWithCode(phone) {
  return requestData("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: TEST_CODE
    })
  });
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
      name: `缺口页验收分类${nextIdempotencyKey().slice(-6)}`
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

async function createPersonalIngredient(authHeaders, template, name) {
  return requestData("/ingredients", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name,
      categoryId: template.categoryId,
      defaultUnitId: template.defaultUnit.id
    })
  });
}

async function createPublishedRecipeFixture(authHeaders, ingredient) {
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);
  const recipeTitle = `缺口页验收菜谱${suffix}`;
  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: recipeTitle,
        story: "用于验证缺口页真实登录态。",
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
            text: "缺口页自动化验收步骤。",
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

  return {
    recipeId: published.recipe.id,
    recipeVersionId: published.recipe.contentVersionId,
    recipeTitle
  };
}

async function createMealPlanFixture(authHeaders, recipe) {
  const suffix = nextIdempotencyKey().slice(-6);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request("/meal-plans", {
      method: "POST",
      headers: withIdempotencyKey(authHeaders),
      body: JSON.stringify({
        planDate: buildPlanDate(30 + attempt),
        mealSlot: "DINNER",
        title: `缺口页验收餐次${suffix}-${attempt}`,
        menuItems: [
          {
            slotType: "MEAT",
            sortOrder: 0,
            recipeId: recipe.recipeId,
            recipeVersionId: recipe.recipeVersionId,
            purchaseState: "PENDING"
          }
        ]
      })
    });

    if (result.status >= 200 && result.status < 300 && result.body.code === 0) {
      return result.body.data;
    }

    if (result.status === 409 && String(result.body.message || "").includes("计划已存在")) {
      continue;
    }

    throw new Error(`/meal-plans HTTP ${result.status}: ${result.body.message}`);
  }

  throw new Error("/meal-plans failed after 10 attempts due to existing plan conflicts");
}

async function createShoppingListFixture(authHeaders) {
  const listName = `缺口页验收清单${nextIdempotencyKey().slice(-6)}`;
  const detail = await requestData("/shopping-lists", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: listName
    })
  });
  return {
    listId: detail.id,
    listName
  };
}

async function createGapFixture(authHeaders) {
  const systemIngredient = await loadSystemIngredient(authHeaders);
  const gapIngredientName = `缺口页验收食材${nextIdempotencyKey().slice(-6)}`;
  const ingredient = await createPersonalIngredient(authHeaders, systemIngredient, gapIngredientName);
  const recipe = await createPublishedRecipeFixture(authHeaders, ingredient);
  const plan = await createMealPlanFixture(authHeaders, recipe);
  const event = await requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt: buildFutureIso(3),
      location: "缺口页自动化验收饭局"
    })
  });
  const shoppingList = await createShoppingListFixture(authHeaders);
  const gap = await requestData("/shopping-gap", {
    headers: authHeaders
  });
  const gapSection = gap.sections.find((section) => section.items.some((item) => item.events.some((entry) => entry.eventId === event.id)));
  const gapItem = gapSection?.items.find((item) => item.events.some((entry) => entry.eventId === event.id));
  assert(gapSection && gapItem, "shopping-gap should expose the created event");

  return {
    shoppingList,
    ingredientName: ingredient.name,
    recipeTitle: recipe.recipeTitle
  };
}

async function waitForShoppingListItem(authHeaders, listId, ingredientName) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const detail = await requestData(`/shopping-lists/${listId}`, {
      headers: authHeaders
    });
    const matched = detail.items.find(
      (item) =>
        item.name === ingredientName &&
        item.sources.some((source) => source.sourceType === "EVENT")
    );
    if (matched) {
      return matched;
    }
    await sleep(300);
  }
  throw new Error("gap action did not write the expected shopping item");
}

describe("pages_pantry/gap/index", () => {
  let page;
  let session;
  let fixture;
  let authHeaders;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    fixture = await createGapFixture(authHeaders);

    await clearSession();
    page = await program.reLaunch(`/pages_pantry/gap/index?listId=${fixture.shoppingList.listId}`);
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".gap-card__title", 8000);
  });

  it("缺口页可以完成真实登录并展示缺口正文主状态", async () => {
    expect(await page.path).toBe("pages_pantry/gap/index");

    const heroTitle = await page.$(".gap-hero__title");
    expect(await heroTitle.text()).toBe("还差 1 样，先把最近的补上");

    const targetCardTitle = await page.$(".target-card__title");
    expect(await targetCardTitle.text()).toBe(fixture.shoppingList.listName);

    const texts = await collectTexts(page);
    expect(texts).toContain("未来 48 小时");
    expect(texts).toContain(fixture.ingredientName);
    expect(texts).toContain(fixture.recipeTitle);
    expect(hasNormalizedText(texts, "涉及 1 场饭局 · 1 道菜")).toBe(true);

    const addButton = await page.$(".gap-card__action");
    expect(await addButton.text()).toBe("加入清单");
    await addButton.tap();

    const createdItem = await waitForShoppingListItem(
      authHeaders,
      fixture.shoppingList.listId,
      fixture.ingredientName
    );
    expect(createdItem.ingredientId).toBeTruthy();
  });
});
