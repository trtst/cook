const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_OWNER_PHONE = process.env.TEST_OWNER_PHONE || "13800000000";

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

async function fetchCurrentUser(token) {
  return requestData("/users/me", {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
}

describe("pages_me/account/index", () => {
  let page;
  let session;
  let profile;

  beforeAll(async () => {
    session = await loginWithPassword(TEST_OWNER_PHONE);
    profile = await fetchCurrentUser(session.token);
    await clearSession();
    page = await program.reLaunch("/pages_me/account/index");
    await page.waitFor(1500);
    await page.callMethod("automatorClearSession");
    await page.waitFor(200);
  });

  it("账号设置页可以展示真实密码登录后的主状态", async () => {
    expect(await page.path).toBe("pages_me/account/index");

    const title = await page.$(".account-navbar__title");
    expect(await title.text()).toBe("账号设置");

    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    }, profile);
    await page.waitFor(".account-page", 8000);

    const loggedTexts = await collectTexts(page);
    expect(loggedTexts).toContain("绑定手机号");
    expect(loggedTexts).toContain("退出登录");
    expect(loggedTexts).toContain(profile.phone || "未绑定");
  });
});
