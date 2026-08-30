const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const ADMIN_USERNAME = process.env.ADMIN_SEED_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "change-me";
const TEST_CODE = "123456";
const OFFICIAL_CHANNEL_CODE = "OFFICIAL_NOTICE";

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
          } catch (_error) {
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

let idempotencySeed = Date.now();

function nextIdempotencyKey() {
  idempotencySeed += 1;
  return String(idempotencySeed);
}

function createFreshPhone() {
  const suffix = `${Date.now()}`.slice(-8).padStart(8, "0");
  return `139${suffix}`;
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

async function createPublishedOfficialMessage() {
  const adminToken = await loginAdmin();
  const adminAuth = { authorization: `Bearer ${adminToken}` };
  const channelResult = await requestData(`/admin/content/channels?page=1&pageSize=50`, { headers: adminAuth }, true);
  const channel = channelResult.items.find(item => item.code === OFFICIAL_CHANNEL_CODE);
  assert(channel, `missing fixed channel ${OFFICIAL_CHANNEL_CODE}`);

  const suffix = `${Date.now()}`.slice(-8);
  const title = `官方消息详情验收 ${suffix}`;
  const summary = "用于验证官方消息详情页真实展示。";
  const heroNote = "站内官方消息自动化验收";
  const draft = await requestData(
    "/admin/content",
    {
      method: "POST",
      headers: {
        ...adminAuth,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        type: "ARTICLE",
        channelId: channel.id,
        slug: `official-message-detail-${suffix}`,
        title,
        summary,
        label: "官方消息",
        heroNote,
        coverImageUrl: null,
        bodyHtml: `<p>${title} 正文</p>`,
        bodyText: `${title} 正文`,
        effectiveAt: null,
        sortOrder: 0
      })
    },
    true
  );
  const published = await requestData(
    `/admin/content/${draft.id}/status`,
    {
      method: "POST",
      headers: {
        ...adminAuth,
        "Idempotency-Key": nextIdempotencyKey()
      },
      body: JSON.stringify({
        status: "PUBLISHED",
        expectedVersion: draft.version
      })
    },
    true
  );

  return {
    messageId: published.id,
    title,
    summary,
    heroNote,
    phone: createFreshPhone()
  };
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

describe("pages_me/official-message/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createPublishedOfficialMessage();
    const session = await loginWithCode(fixture.phone);
    await clearSession();
    page = await program.reLaunch(`/pages_me/official-message/index?messageId=${fixture.messageId}`);
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".detail-hero__title", 8000);
  });

  it("官方消息详情页可以完成真实登录并展示正文主状态", async () => {
    expect(await page.path).toBe("pages_me/official-message/index");

    const state = await page.callMethod("automatorReadState");
    expect(state.loading).toBe(false);
    expect(state.errorText).toBe("");
    expect(state.needLogin).toBe(false);
    expect(state.detail.title).toBe(fixture.title);
    expect(state.detail.summary).toBe(fixture.summary);

    const title = await page.$(".detail-hero__title");
    expect(await title.text()).toBe(fixture.title);

    const texts = await collectTexts(page);
    expect(texts).toContain("系统官方消息");
    expect(texts).toContain(fixture.summary);
    expect(texts).toContain(fixture.heroNote);
  });
});
