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
            resolve({
              status: response.statusCode || 0,
              body: JSON.parse(rawBody || "null")
            });
          } catch {
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

async function resolveSystemIngredient(authHeaders) {
  const ingredients = await requestData("/ingredients?page=1&pageSize=20&source=SYSTEM", {
    headers: authHeaders
  });
  assert(ingredients.items && ingredients.items.length > 0, "missing system ingredient fixture");
  return ingredients.items[0];
}

async function createFridgeItemFixture(authHeaders) {
  const ingredient = await resolveSystemIngredient(authHeaders);
  const item = await requestData("/fridge-items", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: ingredient.name,
      ingredientId: ingredient.id,
      quantityText: `2${ingredient.defaultUnit.name}`,
      exactQuantity: "2",
      exactUnitId: ingredient.defaultUnit.id,
      expireAt: null,
      note: "食材首页自动化验收食材"
    })
  });
  return {
    itemId: item.id,
    ingredientName: ingredient.name
  };
}

async function createExpiringFridgeItemFixture(authHeaders) {
  const ingredient = await resolveSystemIngredient(authHeaders);
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const item = await requestData("/fridge-items", {
    method: "POST",
    headers: withIdempotencyKey(authHeaders),
    body: JSON.stringify({
      name: `${ingredient.name}临期`,
      ingredientId: ingredient.id,
      quantityText: `1${ingredient.defaultUnit.name}`,
      exactQuantity: "1",
      exactUnitId: ingredient.defaultUnit.id,
      expireAt,
      note: "食材首页提醒验收食材"
    })
  });
  return {
    itemId: item.id,
    ingredientName: item.name
  };
}

async function waitForState(page, matcher, timeoutMs = 8000) {
  const startedAt = Date.now();
  let lastState = null;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await page.callMethod("automatorReadState");
    if (matcher(lastState)) return lastState;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error(`pantry state not ready: ${JSON.stringify(lastState)}`);
}

describe("pages_pantry/index/index", () => {
  let page;
  let session;
  let fixture;
  let expiringFixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    const authHeaders = {
      authorization: `Bearer ${session.token}`
    };
    fixture = await createFridgeItemFixture(authHeaders);
    expiringFixture = await createExpiringFridgeItemFixture(authHeaders);

    await clearSession();
    page = await program.reLaunch("/pages_pantry/index/index");
    await page.waitFor(300);
  });

  it("未登录直达后补登录成功，会立即拉回库存首页", async () => {
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    const state = await page.callMethod("automatorHandleLoginSuccess");

    expect(state.loggedIn).toBe(true);
    expect(state.cardCount).toBeGreaterThanOrEqual(2);
    expect(state.expiringCardCount).toBeGreaterThanOrEqual(1);
    expect(state.firstCardName).toBe(expiringFixture.ingredientName);
  });

  it("临期食材存在提醒入口，订阅未通过时不会卡死", async () => {
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.callMethod("automatorHandleLoginSuccess");
    await waitForState(page, state => state && state.expiringCardCount >= 1);

    const state = await page.callMethod("automatorSendExpiryReminder", 0, "unsupported");

    expect(state.loggedIn).toBe(true);
    expect(state.expiringCardCount).toBeGreaterThanOrEqual(1);
    expect(state.reminderSubmittingId).toBe("");
    expect(state.lastReminderFeedback).toBe("当前环境不支持订阅消息");
  });

  it("临期食材提醒在授权通过后会收口成功态", async () => {
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.callMethod("automatorHandleLoginSuccess");
    await waitForState(page, state => state && state.expiringCardCount >= 1);

    const state = await page.callMethod("automatorSendExpiryReminder", 0, "accepted", "success");

    expect(state.loggedIn).toBe(true);
    expect(state.reminderSubmittingId).toBe("");
    expect(state.lastReminderFeedback).toBe("到期提醒已发送");
  });
});
