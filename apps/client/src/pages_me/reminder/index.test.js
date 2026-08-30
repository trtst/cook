const http = require("http");
const https = require("https");
const { URL } = require("url");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
const TEST_CODE = "123456";
jest.setTimeout(30000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function buildSettingsBody(overrides = {}) {
  return {
    reminderDotOnly: false,
    meal: {
      enabled: true,
      times: {
        breakfast: "08:00",
        lunch: "12:00",
        afternoonTea: "15:30",
        dinner: "18:30",
        lateNight: "22:00"
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
  };
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

describe("pages_me/reminder/index", () => {
  let page;
  let session;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());
    await clearSession();
    page = await program.reLaunch("/pages_me/reminder/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".reminder-card", 8000);
  });

  it("提醒设置页展示提醒开关、快捷天数和保存按钮", async () => {
    expect(await page.path).toBe("pages_me/reminder/index");
    await page.waitFor(".reminder-scroll-view", 2000);
    const cards = await page.$$(".reminder-card");
    expect(cards.length).toBe(1);
    const toggles = await page.$$(".setting-toggle");
    expect(toggles.length).toBe(4);

    const state = await page.callMethod("automatorReadState");
    expect(state.reminderDotOnly).toBe(false);
    expect(state.meal.enabled).toBe(true);
    expect(state.meal.times.breakfast).toBe("08:00");
    expect(state.meal.times.afternoonTea).toBe("15:30");
    expect(state.meal.times.lateNight).toBe("21:30");
    expect(state.fridge.days).toBe(3);
    expect(state.recommend.enabled).toBe(false);

    const texts = await collectTexts(page);
    expect(texts).toContain("提醒设置");
    expect(texts).toContain("餐次提醒");
    expect(texts).toContain("我们会在餐次前提醒你，方便你提前安排。");
    expect(texts).not.toContain("开启餐次提醒");
    expect(texts).not.toContain("早餐");
    expect(texts).not.toContain("午餐");
    expect(texts).not.toContain("下午茶");
    expect(texts).not.toContain("晚餐");
    expect(texts).not.toContain("夜宵");
    expect(texts).toContain("食材提醒");
    expect(texts).toContain("临近到期时，按你设置的提前天数提醒处理。");
    expect(texts).toContain("提前天数");
    expect(texts).toContain("3天");
    expect(texts).toContain("5天");
    expect(texts).toContain("7天");
    expect(texts).toContain("推荐提醒");
    expect(texts).toContain("每日推荐更新后提醒你查看。");
    expect(texts).toContain("消息免打扰");
    expect(texts).toContain("关闭强提醒，仅保留站内红点提示。");
    await page.waitFor(".reminder-footer__button", 2000);
  });

  it("提醒设置页会从服务端读取并把保存结果写回服务端", async () => {
    const saved = await requestData("/users/me/notification-settings", {
      method: "PUT",
      headers: buildAuthHeaders(session),
      body: JSON.stringify(
        buildSettingsBody({
          reminderDotOnly: true,
          meal: {
            enabled: false,
            times: {
              breakfast: "07:30",
              lunch: "11:30",
              afternoonTea: "16:00",
              dinner: "18:00",
              lateNight: "21:30"
            }
          },
          fridge: {
            enabled: false,
            days: 5
          },
          recommend: {
            enabled: true
          }
        })
      )
    });

    expect(saved.reminderDotOnly).toBe(true);
    expect(saved.meal.enabled).toBe(false);
    expect(saved.meal.times.breakfast).toBe("07:30");
    expect(saved.fridge.days).toBe(5);
    expect(saved.recommend.enabled).toBe(true);

    page = await program.reLaunch("/pages_me/reminder/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });
    await page.waitFor(".reminder-card", 8000);

    const state = await page.callMethod("automatorReadState");
    expect(state.reminderDotOnly).toBe(true);
    expect(state.meal.enabled).toBe(false);
    expect(state.meal.times.breakfast).toBe("07:30");
    expect(state.fridge.enabled).toBe(false);
    expect(state.fridge.days).toBe(5);
    expect(state.recommend.enabled).toBe(true);

    const toggles = await page.$$(".setting-toggle");
    const chipState = await page.callMethod("automatorSelectFridgeDays", 3);
    expect(chipState.fridge.days).toBe(3);
    const toggledState = await page.callMethod("automatorToggleReminderDotOnly");
    expect(toggledState.reminderDotOnly).toBe(false);
    await page.callMethod("automatorSaveSettings");

    const updated = await requestData("/users/me/notification-settings", {
      headers: buildAuthHeaders(session)
    });
    expect(updated.fridge.days).toBe(3);
    expect(updated.reminderDotOnly).toBe(false);
  });
});
