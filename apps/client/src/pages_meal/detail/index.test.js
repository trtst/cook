const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildFuturePlanDate(daysFromNow = 7) {
  return formatDateOnly(new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000));
}

function buildFutureIso(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function loginWithCode(phone) {
  return loginWithPassword(phone);
}

async function resolveRecipeCategory(authHeaders) {
  const categories = await requestData("/recipe-categories", {
    headers: authHeaders
  });
  if (categories.length) return categories[0];

  const created = await requestData("/recipe-categories", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `饭局详情验收分类${nextIdempotencyKey().slice(-6)}`
    })
  });
  return created;
}

async function createRecipeFixture(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  assert(ingredients.items && ingredients.items.length > 0, "missing system ingredient fixture");
  const ingredient = ingredients.items[0];
  const category = await resolveRecipeCategory(authHeaders);
  const suffix = nextIdempotencyKey().slice(-6);

  const draft = await requestData("/recipe-drafts", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      recipeId: null,
      content: {
        name: `饭局详情验收菜谱${suffix}`,
        story: "用于验证饭局详情页真实正文态。",
        categoryId: category.id,
        sceneIds: [],
        coverUploadId: null,
        coverImageUrl: null,
        baseServings: 2,
        difficulty: "EASY",
        duration: "WITHIN_15",
        tips: "先把菜单和做饭助手展示出来。",
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
            text: "准备食材并开始这顿饭。",
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

async function createMealPlanFixture(authHeaders, recipe, options = {}) {
  return requestData("/meal-plans", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      planDate: options.planDate || buildFuturePlanDate(options.daysFromNow || 7),
      mealSlot: options.mealSlot || "DINNER",
      title: `${options.titlePrefix || "饭局详情验收餐次"}-${nextIdempotencyKey().slice(-6)}`,
      menuItems: [
        {
          slotType: "MEAT",
          sortOrder: 0,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: "READY"
        }
      ]
    })
  });
}

async function createDiningEventFixture(authHeaders, plan, scheduledAt = buildFutureIso(4)) {
  return requestData(`/meal-plans/${plan.id}/dining-event`, {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      scheduledAt,
      location: "饭局详情验收地点"
    })
  });
}

async function waitForTitle(page, expectedTitle, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const title = await page.$(".summary-card__title");
    if (title && (await title.text()).trim() === expectedTitle) return;
    await sleep(200);
  }

  throw new Error(`未在 ${timeout}ms 内等到饭局详情标题: ${expectedTitle}`);
}

async function waitForFocusedSection(page, expectedSection, timeout = 4000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const state = await page.callMethod("automatorReadFocusState");
    if (state && state.focusAttempt && state.focusAttempt.requested === expectedSection && state.focusAttempt.applied) {
      return state;
    }
    await sleep(100);
  }

  throw new Error(`未在 ${timeout}ms 内等到详情 focus 命中: ${expectedSection}`);
}

describe("pages_meal/detail/index", () => {
  let page;
  let fixture;
  let planOnlyFixture;

  beforeAll(async () => {
    const phone = createFreshPhone();
    const session = await loginWithCode(phone);
    const authHeaders = { authorization: `Bearer ${session.token}` };
    const recipe = await createRecipeFixture(authHeaders);
    const plan = await createMealPlanFixture(authHeaders, recipe, {
      titlePrefix: "饭局详情验收饭局餐次",
      daysFromNow: 7
    });
    const event = await createDiningEventFixture(authHeaders, plan);
    const planOnly = await createMealPlanFixture(authHeaders, recipe, {
      titlePrefix: "饭局详情验收计划餐次",
      daysFromNow: 8
    });

    fixture = {
      session,
      title: event.title,
      recipeTitle: event.menuItems[0].title,
      planDate: plan.planDate,
      planItemId: plan.id,
      eventId: event.id,
      scheduledAt: event.scheduledAt
    };

    planOnlyFixture = {
      session,
      title: planOnly.title,
      planDate: planOnly.planDate,
      planItemId: planOnly.id
    };

    await clearSession();
    page = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(page, fixture.title);
  });

  it("饭局详情页可以展示真实饭局正文主状态", async () => {
    expect(await page.path).toBe("pages_meal/detail/index");

    const title = await page.$(".summary-card__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    expect(texts).toContain("参与人");
    expect(texts).toContain("菜单");
    expect(texts).toContain("我想吃池");
    expect(texts).toContain("采购准备");
    expect(texts).toContain("做饭助手");
    expect(texts).toContain("主家菜单");
    expect(texts).toContain(fixture.recipeTitle);
  });

  it("最近安排 focus=shopping 可以命中详情采购区块", async () => {
    await clearSession();
    const focusPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}&focus=shopping`
    );
    await focusPage.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(focusPage, fixture.title);

    const focusState = await waitForFocusedSection(focusPage, "shopping");
    expect(focusState.focusAttempt.targetId).toBe("meal-shopping-panel");
    expect(focusState.showShoppingPanel).toBe(true);
    expect(focusState.hasEventDetail).toBe(true);

    const texts = await collectTexts(focusPage);
    expect(texts).toContain("采购准备");
  });

  it("最近安排无效 focus 可以降级到计划详情默认正文", async () => {
    await clearSession();
    const focusPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}&focus=memory`
    );
    await focusPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(focusPage, planOnlyFixture.title);

    const focusState = await focusPage.callMethod("automatorReadFocusState");
    expect(focusState.hasEventDetail).toBe(false);
    expect(focusState.hasPlanDetail).toBe(true);
    expect(focusState.focusAttempt.requested).toBe("memory");
    expect(focusState.focusAttempt.targetId).toBe("");
    expect(focusState.focusAttempt.applied).toBe(false);

    const texts = await collectTexts(focusPage);
    expect(texts).toContain("菜单");
    expect(texts).toContain("做饭助手");
  });

  it("计划详情 Hero 用餐次提问并提示菜单下一步", async () => {
    await clearSession();
    const planPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${planOnlyFixture.planItemId}&planDate=${planOnlyFixture.planDate}`
    );
    await planPage.callMethod("automatorApplySession", {
      token: planOnlyFixture.session.token,
      uid: planOnlyFixture.session.user.uid,
      expiresAt: planOnlyFixture.session.expiresAt
    });
    await waitForTitle(planPage, planOnlyFixture.title);

    const texts = await collectTexts(planPage);
    expect(texts).toContain("晚餐吃什么？");
    expect(texts).toContain("菜单已添好，继续补齐这顿饭。");
  });

  it("饭局到点后 footer 会自动切到分享回忆态", async () => {
    await clearSession();
    const timeUpPage = await program.reLaunch(
      `/pages_meal/detail/index?planItemId=${fixture.planItemId}&planDate=${fixture.planDate}&eventId=${fixture.eventId}`
    );
    await timeUpPage.callMethod("automatorApplySession", {
      token: fixture.session.token,
      uid: fixture.session.user.uid,
      expiresAt: fixture.session.expiresAt
    });
    await waitForTitle(timeUpPage, fixture.title);
    await timeUpPage.callMethod("automatorSetNowMs", new Date(fixture.scheduledAt).getTime() + 60 * 1000);

    const footerState = await timeUpPage.callMethod("automatorReadFooterState");
    expect(footerState.footerStage).toBe("TIME_UP");
    expect(footerState.endedActionLabel).toBe("分享回忆");
    expect(footerState.primaryActionLabel).toBe("");

    const texts = await collectTexts(timeUpPage);
    expect(texts).toContain("分享回忆");
  });
});
