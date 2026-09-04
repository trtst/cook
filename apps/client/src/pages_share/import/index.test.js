const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_OWNER_PHONE = process.env.TEST_OWNER_PHONE || "13800000000";

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

describe("pages_share/import/index", () => {
  let page;
  let session;
  let profile;

  beforeAll(async () => {
    session = await loginWithPassword(TEST_OWNER_PHONE);
    profile = await fetchCurrentUser(session.token);
    await clearSession();
    page = await program.reLaunch("/pages_share/import/index?token=share-import-test-token");
    await page.waitFor(300);
  });

  it("未登录直达后补登录成功，会立即补齐默认展示名称", async () => {
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      user: session.user,
      expiresAt: session.expiresAt
    }, profile);
    const state = await page.callMethod("automatorHandleLoginSuccess");

    expect(state.loggedIn).toBe(true);
    expect(state.shareToken).toBe("share-import-test-token");
    expect(state.guestName).toBe((session.user.nickname || "").trim() || `用户 ${session.user.uid}`);
    expect(state.canSubmit).toBe(true);
  });

  it("用户资料和 uid 都不可用时，会退回到“你”", async () => {
    const guestPage = await program.reLaunch("/pages_share/import/index?token=share-import-test-token");
    await guestPage.callMethod("automatorClearSession");
    await guestPage.waitFor(300);
    await guestPage.callMethod("automatorApplySession", {
      token: session.token,
      expiresAt: session.expiresAt
    });

    const state = await guestPage.callMethod("automatorHandleLoginSuccess");
    expect(state.loggedIn).toBe(true);
    expect(state.guestName).toBe("你");
    expect(state.canSubmit).toBe(true);
  });
});
