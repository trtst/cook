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
  const nodes = await page.$$(`text`);
  const texts = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) texts.push(value);
  }

  return texts;
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

async function loginWithCode(phone) {
  return requestData("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({
      phone,
      code: TEST_CODE
    })
  });
}

async function loadInspirationRecipeFixture() {
  const list = await requestData("/inspiration-recipes?page=1&pageSize=20");
  const recipe = list.items[0];
  assert(recipe, "missing inspiration recipe fixture");

  const detail = await requestData(`/inspiration-recipes/${recipe.id}`);
  return {
    recipeId: detail.id,
    title: detail.title
  };
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
      name: `营养详情验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
}

async function loadSystemIngredient(authHeaders, name) {
  const result = await requestData(
    `/ingredients?page=1&pageSize=20&source=SYSTEM&keyword=${encodeURIComponent(name)}`,
    {
      headers: authHeaders
    }
  );
  const ingredient = result.items.find((item) => item.name === name);
  assert(ingredient, `missing system ingredient fixture: ${name}`);
  return ingredient;
}

function buildDraftIngredient(ingredient, quantity) {
  return {
    ingredientId: ingredient.id,
    name: ingredient.name,
    quantity: String(quantity),
    unitId: ingredient.defaultUnit.id,
    fuzzyText: null,
    categoryId: ingredient.categoryId,
    defaultUnitId: ingredient.defaultUnit.id,
    source: ingredient.source
  };
}

async function createPublishedRecipeFixture(authHeaders, categoryId, title, ingredients, story) {
  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: title,
        story,
        categoryId,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "用于验证菜谱详情页营养展示。",
        ingredients,
        steps: [
          {
            slotKey: "step-1",
            text: "进入菜谱详情查看营养结果。",
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

  const detail = await requestData(`/recipes/${published.recipe.id}`, {
    headers: authHeaders
  });

  return {
    recipeId: detail.id,
    title: detail.title,
    nutrition: detail.nutrition
  };
}

function formatNutritionValue(value, unit) {
  if (value === null || !Number.isFinite(value)) return "暂缺";
  const normalized = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${normalized}${unit}`;
}

function expectedNutritionTexts(nutrition, mode = "perServing") {
  const texts = [];
  const metrics = mode === "perRecipe" ? nutrition.perRecipe : nutrition.perServing;
  if (!metrics) return texts;
  texts.push(formatNutritionValue(metrics.calories, "kcal"));
  texts.push(formatNutritionValue(metrics.protein, "g"));
  texts.push(formatNutritionValue(metrics.fat, "g"));
  texts.push(formatNutritionValue(metrics.carbohydrate, "g"));
  return texts;
}

async function openRecipeDetail(session, recipeId) {
  await clearSession();
  const page = await program.reLaunch(`/pages_recipe/detail/index?recipeId=${recipeId}&kind=my&mode=published`);
  await page.callMethod("automatorApplySession", {
    token: session.token,
    uid: session.user.uid,
    expiresAt: session.expiresAt
  });
  await page.waitFor(".summary-card__title", 8000);
  return page;
}

async function waitForState(page, matcher, timeoutMs = 8000) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await page.callMethod("automatorReadState");
    if (matcher(lastState)) {
      return lastState;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`detail state not ready: ${JSON.stringify(lastState)}`);
}

describe("pages_recipe/detail/index", () => {
  let session;
  let authHeaders;
  let fixtures;
  let inspirationFixture;

  beforeAll(async () => {
    inspirationFixture = await loadInspirationRecipeFixture();
    const phone = createFreshPhone();
    session = await loginWithCode(phone);
    authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    const category = await resolveRecipeCategory(authHeaders);
    const suffix = nextIdempotencyKey().slice(-6);
    const ingredients = {
      lotusRoot: await loadSystemIngredient(authHeaders, "莲藕"),
      porkRib: await loadSystemIngredient(authHeaders, "排骨"),
      ginger: await loadSystemIngredient(authHeaders, "生姜"),
      tomato: await loadSystemIngredient(authHeaders, "番茄"),
      egg: await loadSystemIngredient(authHeaders, "鸡蛋"),
      greenPepper: await loadSystemIngredient(authHeaders, "青椒")
    };

    fixtures = {
      complete: await createPublishedRecipeFixture(
        authHeaders,
        category.id,
        `营养完整验收菜谱${suffix}`,
        [
          buildDraftIngredient(ingredients.lotusRoot, 400),
          buildDraftIngredient(ingredients.porkRib, 500),
          buildDraftIngredient(ingredients.ginger, 20)
        ],
        "用于验证 COMPLETE 营养展示。"
      ),
      estimated: await createPublishedRecipeFixture(
        authHeaders,
        category.id,
        `营养估算验收菜谱${suffix}`,
        [
          buildDraftIngredient(ingredients.tomato, 2),
          buildDraftIngredient(ingredients.egg, 3),
          buildDraftIngredient(ingredients.greenPepper, 2)
        ],
        "用于验证 ESTIMATED 营养展示。"
      ),
      insufficient: await createPublishedRecipeFixture(
        authHeaders,
        category.id,
        `营养不足验收菜谱${suffix}`,
        [buildDraftIngredient(ingredients.greenPepper, 2)],
        "用于验证 INSUFFICIENT 营养展示。"
      ),
      recommendable: await createPublishedRecipeFixture(
        authHeaders,
        category.id,
        `投稿验收菜谱${suffix}`,
        [
          buildDraftIngredient(ingredients.tomato, 2),
          buildDraftIngredient(ingredients.egg, 2)
        ],
        "用于验证菜谱投稿主路径。"
      )
    };
  });

  it("菜谱详情页可以展示真实灵感菜谱正文主状态", async () => {
    await clearSession();
    const page = await program.reLaunch(
      `/pages_recipe/detail/index?recipeId=${inspirationFixture.recipeId}&kind=inspiration&mode=published`
    );
    await page.waitFor(".summary-card__title", 8000);

    expect(await page.path).toBe("pages_recipe/detail/index");

    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(inspirationFixture.title);

    const texts = await collectTexts(page);
    expect(texts).toContain("营养估算");
    expect(texts).toContain("单份营养为估算值，仅供参考");
    expect(texts).toContain("食材清单");
    expect(texts).toContain("步骤");
    expect(texts).toContain("加入采购清单");
  });

  it("菜谱详情页可以展示真实 COMPLETE 营养结果", async () => {
    const fixture = fixtures.complete;
    expect(fixture.nutrition.status).toBe("COMPLETE");

    const page = await openRecipeDetail(session, fixture.recipeId);
    expect(await page.path).toBe("pages_recipe/detail/index");

    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    expect(texts).toContain("营养估算");
    expect(texts).toContain("单份营养为估算值，仅供参考");
    expect(texts).toContain("食材清单");
    expect(texts).toContain("步骤");
    expect(texts).toContain("加入采购清单");

    for (const expectedText of expectedNutritionTexts(fixture.nutrition)) {
      expect(texts).toContain(expectedText);
    }

    const perServingToggle = await page.$(".nutrition-toggle__item--active");
    expect(perServingToggle).toBeTruthy();
    expect(await perServingToggle.text()).toBe("单份");
    const perRecipeToggle = await page.$$(".nutrition-toggle__item");
    expect(perRecipeToggle.length).toBe(2);
    await perRecipeToggle[1].tap();

    const toggledTexts = await collectTexts(page);
    expect(toggledTexts).toContain("整份营养为估算值，仅供参考");
    for (const expectedText of expectedNutritionTexts(fixture.nutrition, "perRecipe")) {
      expect(toggledTexts).toContain(expectedText);
    }
  });

  it("菜谱详情页可以展示真实 ESTIMATED 营养结果", async () => {
    const fixture = fixtures.estimated;
    expect(fixture.nutrition.status).toBe("ESTIMATED");

    const page = await openRecipeDetail(session, fixture.recipeId);
    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    for (const expectedText of expectedNutritionTexts(fixture.nutrition)) {
      expect(texts).toContain(expectedText);
    }
    expect(texts).toContain("单份营养为估算值，仅供参考");
  });

  it("菜谱详情页在营养不足时不再展示状态文案", async () => {
    const fixture = fixtures.insufficient;
    expect(fixture.nutrition.status).toBe("INSUFFICIENT");
    expect(fixture.nutrition.perRecipe).toBeNull();

    const page = await openRecipeDetail(session, fixture.recipeId);
    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    const nutritionSection = await page.$("#detail-nutrition");
    expect(nutritionSection).toBeFalsy();
    expect(texts).not.toContain("营养估算");
    expect(texts).not.toContain("当前为每份营养估算，结果可能不准确，仅供参考");
    expect(texts).not.toContain("暂无营养估算");
    expect(texts).not.toContain("估算较完整");
    expect(texts).not.toContain("结果为估算");
    expect(texts).not.toContain("当前数据不足");
  });

  it("菜谱详情页可以提交真实投稿并切到审核中", async () => {
    const fixture = fixtures.recommendable;
    const page = await openRecipeDetail(session, fixture.recipeId);

    const initialState = await waitForState(
      page,
      (state) => state && state.title === fixture.title && state.recommendActionLabel === "投稿"
    );
    expect(initialState.recommendationStatus).toBeNull();

    const recommendEntry = await page.$(".detail-inline-actions__item--recommend");
    expect(recommendEntry).toBeTruthy();
    await recommendEntry.tap();

    const sheetState = await waitForState(
      page,
      (state) => state && state.recommendSheetVisible && state.recommendCategoryCount > 0 && state.selectedRecommendCategoryId
    );
    expect(sheetState.recommendActionLabel).toBe("投稿");

    const confirmButton = await page.$(".sheet-actions__button--confirm");
    expect(confirmButton).toBeTruthy();
    await confirmButton.tap();

    const submittedState = await waitForState(
      page,
      (state) => state && state.recommendationStatus === "PENDING" && !state.recommendSheetVisible
    );
    expect(submittedState.recommendActionLabel).toBe("审核中");

    const detail = await requestData(`/recipes/${fixture.recipeId}`, {
      headers: authHeaders
    });
    expect(detail.recommendation).toBeTruthy();
    expect(detail.recommendation.status).toBe("PENDING");

    const texts = await collectTexts(page);
    expect(texts).toContain("审核中");
  });
});
