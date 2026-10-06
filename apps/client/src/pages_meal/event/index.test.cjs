const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;
const { loginWithPassword } = require("../../test-utils/auth-fixture");

const hasJestRuntime =
  (typeof process !== "undefined" && Boolean(process.env.JEST_WORKER_ID)) ||
  (typeof globalThis.describe === "function" && typeof globalThis.it === "function");
const hasAutomatorRuntime = hasJestRuntime && typeof globalThis.program !== "undefined";
const nodeTest = hasJestRuntime ? null : require("node:test");

if (!hasAutomatorRuntime && !hasJestRuntime) {
  globalThis.jest = { setTimeout() {} };
  globalThis.describe = () => {};
  globalThis.it = () => {};
  globalThis.beforeAll = () => {};
}

globalThis.jest?.setTimeout?.(30000);

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
      loginMode: "phone"
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

if (!hasAutomatorRuntime && nodeTest) {
  const eventPageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

  nodeTest("dining event detail routing preserves planItemId for the meal assistant target", () => {
    nodeAssert.match(eventPageSource, /buildEventDetailPath\(result\.id, createPlanDate\.value, result\.planItemId\)/);
    nodeAssert.match(eventPageSource, /buildEventDetailPath\(existingEvent\.id, createPlanDate\.value, existingEvent\.planItemId \?\? undefined\)/);
    nodeAssert.match(eventPageSource, /planItemId \? `planItemId=\$\{encodeURIComponent\(String\(planItemId\)\)\}` : ""/);
  });
}
