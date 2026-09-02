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

async function openRandomPageWithSession(session) {
  const homePage = await program.reLaunch("/pages/home/index");
  await homePage.callMethod("automatorApplySessionOnly", {
    token: session.token,
    uid: session.user.uid,
    expiresAt: session.expiresAt
  });
  return program.reLaunch("/pages_meal/random/index");
}

describe("pages_meal/random/index", () => {
  let page;
  let session;

  beforeAll(async () => {
    session = await loginWithCode(createFreshPhone());

    await clearSession();
    page = await openRandomPageWithSession(session);
    await page.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: true
    });
    await page.waitFor(1500);
  });

  it("随机页可以完成真实登录并展示决策台初始主状态", async () => {
    expect(await page.path).toBe("pages_meal/random/index");

    const texts = await collectTexts(page);
    expect(texts).toContain("帮我决定");
    expect(texts).toContain("先生成一桌，再慢慢挑合适的");
    expect(texts).toContain("会先给你一桌参考菜单，喜欢的留着，不合适的再换一道，不用一下子做完决定。");
  });

  it("随机页生成结果会在菜位卡片里展示菜名、理由和来源", async () => {
    await page.callMethod("automatorPrimeSlots", [
      {
        slotId: "slot-meat-1",
        slotType: "MEAT",
        slotIndex: 0,
        sourceType: "MY",
        recipeId: 1001,
        recipeVersionId: 2001,
        title: "番茄牛腩",
        coverUrl: null,
        servings: 2,
        duration: "BETWEEN_30_60",
        durationText: "45分钟",
        estimatedCalories: null,
        flavorTags: ["家常"],
        mainProteinType: "BEEF",
        fridgeFit: "HIGH",
        matchedIngredients: ["牛腩"],
        recommendationReason: "冰箱里有"
      }
    ]);

    const state = await page.callMethod("automatorReadSlotCards");
    expect(state.hasMenu).toBe(true);
    expect(state.cards).toEqual([
      {
        slotType: "MEAT",
        title: "番茄牛腩",
        recommendationReason: "冰箱里有",
        sourceType: "MY",
        fridgeFit: "HIGH",
        durationText: "45分钟",
        servings: 2,
        mainProteinType: "BEEF",
        matchedIngredients: ["牛腩"],
        flavorTags: ["家常"]
      }
    ]);
  });

  it("游客点生成一桌时，会先打开登录弹窗", async () => {
    const guestPage = await openRandomPageWithSession(session);
    await guestPage.callMethod("automatorClearSession");
    await guestPage.waitFor(300);
    await guestPage.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: true
    });

    const state = await guestPage.callMethod("automatorTriggerGuestGenerate");
    expect(state.loggedIn).toBe(false);
    expect(state.loginVisible).toBe(true);
  });

  it("游客点冰箱优先勾选时，会先打开登录弹窗且不改本地状态", async () => {
    const guestPage = await openRandomPageWithSession(session);
    await guestPage.callMethod("automatorClearSession");
    await guestPage.waitFor(300);
    await guestPage.callMethod("automatorPrimeConditions", {
      mealSlot: "DINNER",
      peopleCount: 4,
      fridgePreferred: false
    });

    const state = await guestPage.callMethod("automatorTriggerGuestToggleFridge");
    expect(state.loggedIn).toBe(false);
    expect(state.loginVisible).toBe(true);
    expect(state.fridgePreferred).toBe(false);
  });

  it("游客直达随机页时会回首页并呼起登录，不停留在随机页", async () => {
    await clearSession();
    const homePage = await program.reLaunch("/pages/home/index");
    await homePage.callMethod("automatorClearSession");

    const blockedPage = await program.reLaunch("/pages_meal/random/index");
    await blockedPage.waitFor(800);

    expect(await blockedPage.path).toBe("pages/home/index");
    expect(await blockedPage.callMethod("automatorReadLoginGateState")).toEqual({
      loggedIn: false,
      loginVisible: true
    });
  });
});
