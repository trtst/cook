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

async function requestOk(path, options = {}) {
  const result = await request(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body;
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

async function buildFixture(session) {
  const authHeaders = {
    authorization: `Bearer ${session.token}`
  };
  const categories = await requestData("/ingredient-categories", {
    headers: authHeaders
  });
  assert(categories.length > 0, "missing ingredient categories fixture");

  let ingredientCategory = null;
  let ingredient = null;

  for (const category of categories) {
    const result = await requestData(
      `/ingredients?page=1&pageSize=20&source=SYSTEM&categoryId=${encodeURIComponent(String(category.id))}`,
      { headers: authHeaders }
    );
    if (result.items && result.items.length > 0) {
      ingredientCategory = category;
      ingredient = result.items[0];
      break;
    }
  }

  assert(ingredientCategory, "missing system ingredient fixture");
  assert(ingredient, "missing first system ingredient fixture");

  const units = await requestData("/units?page=1&pageSize=100&source=SYSTEM", {
    headers: authHeaders
  });
  assert(units.items && units.items.length > 0, "missing system unit fixture");

  const firstUnit = units.items[0];
  const unitTypeLabelMap = {
    WEIGHT: "重量",
    VOLUME: "体积",
    COMMON: "常用",
    PACKAGE: "包装"
  };

  return {
    categoryId: ingredientCategory.id,
    categoryName: ingredientCategory.name,
    ingredientName: ingredient.name,
    ingredientUnitName: ingredient.defaultUnit.name,
    firstUnitGroupLabel: unitTypeLabelMap[firstUnit.type],
    firstUnitName: firstUnit.name
  };
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

  throw new Error(`ingredient-units state not ready: ${JSON.stringify(lastState)}`);
}

describe("pages_me/ingredient-units/index", () => {
  let page;
  let guestPage;
  let session;
  let fixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    fixture = await buildFixture(session);

    await clearSession();
    page = await program.reLaunch("/pages_me/ingredient-units/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.callMethod("automatorSelectIngredientCategory", fixture.categoryId);
    await waitForState(page, (state) => state && state.activeCategoryId === fixture.categoryId && state.ingredientCount > 0);
  });

  it("食材与单位页可以展示真实系统食材主状态", async () => {
    expect(await page.path).toBe("pages_me/ingredient-units/index");

    const state = await page.callMethod("automatorReadState");
    expect(state.isLoggedIn).toBe(true);
    expect(state.activeTab).toBe("ingredient");
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.categoryCount).toBeGreaterThan(0);
    expect(state.activeCategoryName).toBe(fixture.categoryName);
    expect(state.ingredientCount).toBeGreaterThan(0);
    expect(state.firstIngredientName).toBe(fixture.ingredientName);
    expect(state.firstIngredientUnitName).toBe(fixture.ingredientUnitName);

    const texts = await collectTexts(page);
    expect(texts).toContain(fixture.categoryName);
    expect(texts).toContain(fixture.ingredientName);
  });

  it("食材与单位页可以切到单位页展示系统单位分组", async () => {
    const switchedState = await page.callMethod("automatorSwitchTab", "unit");
    expect(switchedState.activeTab).toBe("unit");

    const state = await waitForState(page, (value) => value && value.activeTab === "unit" && value.unitGroupCount > 0);
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.unitGroupCount).toBeGreaterThan(0);
    expect(state.firstUnitGroupLabel).toBe(fixture.firstUnitGroupLabel);
    expect(state.firstUnitName).toBe(fixture.firstUnitName);

    const texts = await collectTexts(page);
    expect(texts).toContain("用量选择及填写建议");
    expect(texts).toContain(fixture.firstUnitGroupLabel);
    expect(texts).toContain(fixture.firstUnitName);
  });

  it("未登录也可以读取系统食材与系统单位", async () => {
    const categories = await requestOk("/ingredient-categories");
    expect(Array.isArray(categories.data)).toBe(true);
    expect(categories.data.length).toBeGreaterThan(0);

    const ingredients = await requestOk(
      `/ingredients?page=1&pageSize=20&source=SYSTEM&categoryId=${encodeURIComponent(String(fixture.categoryId))}`
    );
    expect(Array.isArray(ingredients.data.items)).toBe(true);
    expect(ingredients.data.items.length).toBeGreaterThan(0);
    expect(ingredients.data.items[0].name).toBe(fixture.ingredientName);

    const units = await requestOk("/units?page=1&pageSize=100&source=SYSTEM");
    expect(Array.isArray(units.data.items)).toBe(true);
    expect(units.data.items.length).toBeGreaterThan(0);
    expect(units.data.items[0].name).toBe(fixture.firstUnitName);
  });

  it("未登录进入食材与单位页也会展示系统数据", async () => {
    await clearSession();
    guestPage = await program.reLaunch("/pages_me/ingredient-units/index");
    await waitForState(guestPage, (state) => state && state.categoryCount > 0 && state.ingredientCount > 0);

    const state = await guestPage.callMethod("automatorReadState");
    expect(state.isLoggedIn).toBe(false);
    expect(state.activeTab).toBe("ingredient");
    expect(state.errorText).toBe("");
    expect(state.categoryCount).toBeGreaterThan(0);
    expect(state.activeCategoryName).toBe(fixture.categoryName);
    expect(state.ingredientCount).toBeGreaterThan(0);
    expect(state.firstIngredientName).toBe(fixture.ingredientName);

    const unitState = await guestPage.callMethod("automatorSwitchTab", "unit");
    expect(unitState.activeTab).toBe("unit");
    const readyUnitState = await waitForState(guestPage, (value) => value && value.activeTab === "unit" && value.unitGroupCount > 0);
    expect(readyUnitState.firstUnitGroupLabel).toBe(fixture.firstUnitGroupLabel);
    expect(readyUnitState.firstUnitName).toBe(fixture.firstUnitName);
  });
});
