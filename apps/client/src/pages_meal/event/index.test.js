const http = require("http");
const https = require("https");
const { URL } = require("url");
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const API_BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:3100/api";
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
  return loginWithPassword(phone);
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

describe("pages_meal/event/index", () => {
  let page;
  let session;

  beforeAll(async () => {
    await clearSession();
    page = await program.reLaunch("/pages_meal/event/index");
    await page.callMethod("automatorClearSession");
    await page.waitFor(1500);
  });

  it("饭局页可以在 mp-weixin 自动化里完成基础挂载 smoke", async () => {
    expect(await page.path).toBe("pages_meal/event/index");

    const texts = await collectTexts(page);
    expect(texts).toContain("待我处理");
    expect(texts).toContain("进行中");
    expect(texts).toContain("已结束");
  });

  it("未登录点击右下角发起饭局先呼起登录，不直接打开创建 sheet", async () => {
    expect(await page.callMethod("automatorOpenCreateSheet")).toEqual({
      loggedIn: false,
      createSheetVisible: false,
      loginVisible: true,
      loginMode: "wechat"
    });
  });

  it("创建饭局时修改时间会把餐次自动切到对应时段", async () => {
    session = await loginWithCode(createFreshPhone());
    page = await program.reLaunch("/pages_meal/event/index");
    await page.callMethod("automatorApplySession", {
      token: session.token,
      uid: session.user.uid,
      expiresAt: session.expiresAt
    });

    const opened = await page.callMethod("automatorOpenCreateSheet");
    expect(opened.loggedIn).toBe(true);
    expect(opened.createSheetVisible).toBe(true);

    const createTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tomorrow = `${createTomorrow.getFullYear()}-${`${createTomorrow.getMonth() + 1}`.padStart(2, "0")}-${`${createTomorrow.getDate()}`.padStart(2, "0")}`;
    await page.callMethod("automatorSelectCreateDate", tomorrow);

    const breakfastState = await page.callMethod("automatorSelectCreateMealSlot", "BREAKFAST");
    expect(breakfastState.createMealSlot).toBe("BREAKFAST");
    expect(breakfastState.createTime).toBe("08:00");

    const dinnerState = await page.callMethod("automatorSelectCreateTime", "18:55");
    expect(dinnerState.createMealSlot).toBe("DINNER");
    expect(dinnerState.createTime).toBe("18:55");

    const lateNightState = await page.callMethod("automatorSelectCreateTime", "23:10");
    expect(lateNightState.createMealSlot).toBe("LATE_NIGHT");
    expect(lateNightState.createTime).toBe("23:10");
  });
});
