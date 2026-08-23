const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_CODE = "123456";
const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";

jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
  await program.callUniMethod("removeStorageSync", READ_STORAGE_KEY);
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

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
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

async function createUnitRecommendationFixture(session) {
  const authHeaders = {
    authorization: `Bearer ${session.token}`,
    "Idempotency-Key": nextIdempotencyKey()
  };
  const unitName = `验收单位${nextIdempotencyKey().slice(-6)}`;

  await requestData("/units", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: unitName,
      type: "WEIGHT"
    })
  });

  return {
    unitName,
    previewText: `“${unitName}”正在审核中`
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

  throw new Error(`recommend state not ready: ${JSON.stringify(lastState)}`);
}

describe("pages_me/recommend/index", () => {
  let page;
  let session;
  let fixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    fixture = await createUnitRecommendationFixture(session);

    await clearSession();
    page = await program.reLaunch("/pages_me/recommend/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await waitForState(page, (state) =>
      state &&
      state.groupCount >= 2 &&
      state.messageGroups.some((item) => item.key === "recommend" && item.preview.includes(fixture.unitName))
    );
  });

  it("通知中心页可以展示真实推荐审核主状态", async () => {
    expect(await page.path).toBe("pages_me/recommend/index");

    const state = await page.callMethod("automatorReadState");
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.groupCount).toBeGreaterThanOrEqual(2);

    const recommendGroup = state.messageGroups.find((item) => item.key === "recommend");
    expect(recommendGroup).toBeTruthy();
    expect(recommendGroup.name).toBe("推荐审核");
    expect(recommendGroup.preview).toContain(fixture.unitName);
    expect(recommendGroup.preview).toBe(fixture.previewText);
    expect(recommendGroup.recommendKind).toBe("unit");
    expect(recommendGroup.hasUnread).toBe(true);

    const shoppingGroup = state.messageGroups.find((item) => item.key === "shoppingInvite");
    expect(shoppingGroup).toBeTruthy();
    expect(shoppingGroup.name).toBe("清单协作");
    expect(shoppingGroup.preview.length).toBeGreaterThan(0);

    const texts = await collectTexts(page);
    expect(texts).toContain("通知中心");
    expect(texts).toContain("推荐审核");
    expect(texts).toContain("清单协作");
    expect(texts).toContain(fixture.previewText);
  });
});
