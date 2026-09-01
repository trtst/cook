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
      response => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({ status: response.statusCode || 0, body: JSON.parse(rawBody || "null") });
          } catch (error) {
            reject(new Error(`invalid json response from ${path}: ${rawBody}`));
          }
        });
      }
    );

    requestTask.on("error", reject);
    if (options.body) requestTask.write(options.body);
    requestTask.end();
  });
}

async function requestData(path, options = {}) {
  const result = await request(path, options);
  assert(result.status >= 200 && result.status < 300, `${path} HTTP ${result.status}: ${result.body.message}`);
  assert(result.body.code === 0, `${path} code ${result.body.code}: ${result.body.message}`);
  return result.body.data;
}

async function loginWithCode(phone) {
  return requestData("/auth/code-login", {
    method: "POST",
    body: JSON.stringify({ phone, code: TEST_CODE })
  });
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
}

describe("pages_me/recipe-history/index", () => {
  let page;
  let session;
  let recipe;

  beforeAll(async () => {
    await clearSession();
    page = await program.reLaunch("/pages_me/recipe-history/index");
    await page.callMethod("automatorClearSession");
  });

  it("未登录时只提供登录入口", async () => {
    await page.waitFor(".recipe-history-login", 3000);

    const state = await page.callMethod("automatorReadState");
    expect(state.loginEntryVisible).toBe(true);
    expect((await page.$$(".recipe-history-login")).length).toBeGreaterThan(0);
  });

  it("登录后展示最近查看的菜谱并支持刷新", async () => {
    recipe = (await requestData("/inspiration-recipes?page=1&pageSize=20")).items[0];
    assert(recipe, "seeded inspiration recipe is required");
    session = await loginWithCode(createFreshPhone());
    await requestData("/users/me/recipe-history", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.token}`,
        "Idempotency-Key": String(Date.now())
      },
      body: JSON.stringify({ recipeId: recipe.id })
    });

    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".history-card", 8000);

    const state = await page.callMethod("automatorReadState");
    expect(state.itemCount).toBeGreaterThanOrEqual(1);
    expect(state.firstItem).toMatchObject({
      title: recipe.title,
      sourceType: "INSPIRATION",
      isAvailable: true
    });

    await page.callMethod("automatorTriggerRefresh");
    const refreshedState = await page.callMethod("automatorReadState");
    expect(refreshedState.itemCount).toBeGreaterThanOrEqual(1);
    expect(refreshedState.firstItem.title).toBe(recipe.title);
  });
});
