const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";
const TEST_CODE = "123456";
const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";
const OFFICIAL_CHANNEL_CODE = "OFFICIAL_NOTICE";

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

async function requestAdminData(path, options = {}) {
  const result = await request(path, {
    ...options,
    headers: {
      "x-cook-from": "admin_web",
      "x-admin-version": "0.1.0",
      "x-admin-build": "1",
      ...(options.headers || {})
    }
  });
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

function buildAuthHeaders(session) {
  return {
    authorization: `Bearer ${session.token}`
  };
}

async function loginAdmin() {
  const result = await requestAdminData("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    })
  });
  return result.token;
}

async function createPublishedOfficialMessage() {
  const adminToken = await loginAdmin();
  const adminAuth = { authorization: `Bearer ${adminToken}` };
  const channels = await requestAdminData("/admin/content/channels?page=1&pageSize=50", {
    headers: adminAuth
  });
  const channel = channels.items.find((item) => item.code === OFFICIAL_CHANNEL_CODE);
  assert(channel, `missing fixed channel ${OFFICIAL_CHANNEL_CODE}`);

  const suffix = `${Date.now()}`.slice(-8);
  const title = `官方消息验收 ${suffix}`;
  const summary = "用于验证通知中心展示系统官方消息。";
  const draft = await requestAdminData("/admin/content", {
    method: "POST",
    headers: {
      ...adminAuth,
      "Idempotency-Key": nextIdempotencyKey()
    },
    body: JSON.stringify({
      type: "ARTICLE",
      channelId: channel.id,
      slug: `official-notice-${suffix}`,
      title,
      summary,
      label: "官方消息",
      heroNote: null,
      coverImageUrl: null,
      bodyHtml: `<p>${title} 正文</p>`,
      bodyText: `${title} 正文`,
      effectiveAt: null,
      sortOrder: 0
    })
  });

  const published = await requestAdminData(`/admin/content/${draft.id}/status`, {
    method: "POST",
    headers: {
      ...adminAuth,
      "Idempotency-Key": nextIdempotencyKey()
    },
    body: JSON.stringify({
      status: "PUBLISHED",
      expectedVersion: draft.version
    })
  });

  return {
    title,
    summary,
    messageId: published.id
  };
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

async function createExpiringFridgeItemFixture(session) {
  const expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return requestData("/fridge-items", {
    method: "POST",
    headers: {
      ...buildAuthHeaders(session),
      "Idempotency-Key": nextIdempotencyKey()
    },
    body: JSON.stringify({
      operationId: nextIdempotencyKey(),
      name: `临期食材${nextIdempotencyKey().slice(-6)}`,
      quantityText: "1 份",
      expireAt
    })
  });
}

async function updateNotificationSettings(session, overrides = {}) {
  return requestData("/users/me/notification-settings", {
    method: "PUT",
    headers: buildAuthHeaders(session),
    body: JSON.stringify({
      reminderDotOnly: false,
      meal: {
        enabled: true,
        times: {
          breakfast: "08:00",
          lunch: "12:00",
          afternoonTea: "15:30",
          dinner: "18:30",
          lateNight: "21:30"
        }
      },
      fridge: {
        enabled: true,
        days: 3
      },
      recommend: {
        enabled: false
      },
      ...overrides
    })
  });
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
  let officialFixture;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    fixture = await createUnitRecommendationFixture(session);
    officialFixture = await createPublishedOfficialMessage();

    await clearSession();
    page = await program.reLaunch("/pages_me/recommend/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await waitForState(page, (state) =>
      state &&
      state.itemCount >= 2 &&
      state.items.some((item) => item.typeLabel === "系统审核消息" && item.title.includes(fixture.unitName)) &&
      state.items.some((item) => item.typeLabel === "系统官方消息" && item.title === officialFixture.title)
    );
  });

  it("通知中心页直接按时间倒序展示混排消息列表", async () => {
    expect(await page.path).toBe("pages_me/recommend/index");

    const state = await page.callMethod("automatorReadState");
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.itemCount).toBeGreaterThanOrEqual(1);

    const reviewItem = state.items.find((item) => item.typeLabel === "系统审核消息");
    expect(reviewItem).toBeTruthy();
    expect(reviewItem.title).toContain(fixture.unitName);
    expect(reviewItem.desc).toBe(fixture.previewText);
    expect(reviewItem.timeText.length).toBeGreaterThan(0);

    const officialItem = state.items.find((item) => item.typeLabel === "系统官方消息");
    expect(officialItem).toBeTruthy();
    expect(officialItem.title).toBe(officialFixture.title);
    expect(officialItem.desc).toBe(officialFixture.summary);
    expect(officialItem.targetPath).toContain(`/pages_me/official-message/index?messageId=${officialFixture.messageId}`);

    const texts = await collectTexts(page);
    expect(texts).toContain("通知中心");
    expect(texts).toContain("系统审核消息");
    expect(texts).toContain("系统官方消息");
    expect(texts).toContain(officialFixture.title);
    expect(texts).toContain(fixture.previewText);
    expect(texts).not.toContain("待处理提醒");
    expect(texts).not.toContain("消息历史");
  });

  it("进入通知中心后会把服务端未读徽标清零", async () => {
    const unreadFixture = await createUnitRecommendationFixture(session);
    const beforeBadge = await requestData("/users/me/notification-badge", {
      headers: buildAuthHeaders(session)
    });
    expect(beforeBadge.unreadCount).toBeGreaterThan(0);

    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await waitForState(
      page,
      (state) => state && state.items.some((item) => item.typeLabel === "系统审核消息" && item.title.includes(unreadFixture.unitName))
    );

    const afterBadge = await requestData("/users/me/notification-badge", {
      headers: buildAuthHeaders(session)
    });
    expect(afterBadge.unreadCount).toBe(0);
    expect(afterBadge.reminderUnreadCount).toBe(0);
    expect(afterBadge.showReminderDot).toBe(false);
  });

  it("通知中心支持滚动容器与下拉刷新重新加载消息", async () => {
    await page.waitFor(".notification-scroll", 2000);

    const refreshFixture = await createUnitRecommendationFixture(session);
    const beforeRefresh = await page.callMethod("automatorReadState");
    expect(beforeRefresh.items.some((item) => item.title.includes(refreshFixture.unitName))).toBe(false);

    await page.callMethod("automatorTriggerRefresh");
    const afterRefresh = await waitForState(
      page,
      (state) => state && state.items.some((item) => item.title.includes(refreshFixture.unitName))
    );

    expect(afterRefresh.loadCount).toBeGreaterThan(beforeRefresh.loadCount);
    expect(afterRefresh.refreshing).toBe(false);
  });

  it("关闭食材提醒后不再展示临期提醒消息", async () => {
    await createExpiringFridgeItemFixture(session);
    await updateNotificationSettings(session, {
      meal: {
        enabled: false,
        times: {
          breakfast: "08:00",
          lunch: "12:00",
          afternoonTea: "15:30",
          dinner: "18:30",
          lateNight: "21:30"
        }
      },
      fridge: {
        enabled: false,
        days: 3
      }
    });

    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    const state = await waitForState(page, (nextState) => nextState && nextState.loading === false);

    expect(state.items.some((item) => item.title === "食材到期提醒")).toBe(false);
  });

  it("未登录直达通知中心会拉起登录而不是直接落加载失败", async () => {
    await clearSession();
    const guestPage = await program.reLaunch("/pages_me/recommend/index");
    const state = await waitForState(guestPage, (nextState) => nextState && nextState.needLogin === true);

    expect(state.errorText).toBe("");
    expect(state.itemCount).toBe(0);
  });
});
