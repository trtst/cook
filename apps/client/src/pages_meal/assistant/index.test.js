const { createMealAssistantFixture } = require("../../test-utils/meal-assistant-fixture.js");
const { readFileSync } = require("fs");
const { resolve } = require("path");
const nodeAssert = require("assert").strict;

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

async function waitForAssistantTitle(page, expectedTitle, timeout = 8000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const state = await page.callMethod("automatorReadState");
    if (state && state.title === expectedTitle) return state;
    await page.waitFor(100);
  }

  throw new Error(`未在 ${timeout}ms 内等到做饭助手标题: ${expectedTitle}`);
}

describe("pages_meal/assistant/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createMealAssistantFixture();
    await clearSession();
    page = await program.reLaunch(
      `/pages_meal/assistant/index?planItemId=${fixture.plan.id}&planDate=${fixture.plan.planDate}&eventId=${fixture.event.id}`
    );
    await page.callMethod("automatorApplySession", {
      token: fixture.paidSession.token,
      uid: fixture.paidSession.user.uid,
      expiresAt: fixture.paidSession.expiresAt
    });
    await waitForAssistantTitle(page, fixture.event.title);
  });

  it("做饭助手页可以展示真实未生成主状态", async () => {
    expect(await page.path).toBe("pages_meal/assistant/index");

    const state = await page.callMethod("automatorReadState");
    expect(state.title).toBe(fixture.event.title);
    expect(state.menuCount).toBe(2);
    expect(state.unlocked).toBe(false);
    expect(state.status).toBe("NOT_GENERATED");
    expect(state.assistantStatusText).toBe("未生成");
    expect(state.actionLabel).toBe("生成并解锁");

    const texts = await collectTexts(page);
    expect(texts).toContain("这桌吃什么");
    expect(texts).toContain("先整理这桌菜，再开始做饭");
    expect(texts).toContain(fixture.paidGeneratedRecipe.title);
    expect(texts).toContain(fixture.paidMissingRecipe.title);
  });

  it("做饭助手页可以生成/解锁真实建议并展示结果", async () => {
    const state = await page.callMethod("automatorGenerateCookAssistant");
    expect(state.unlocked).toBe(true);
    expect(state.prepTaskCount).toBeGreaterThan(0);
    expect(state.timelineStepCount).toBeGreaterThan(0);
    expect(state.noteTexts.some((item) => item.includes("实时补齐"))).toBe(false);
    expect(state.actionLabel).toBe("按菜谱做饭");

    const texts = await collectTexts(page);
    expect(texts).toContain("前期准备");
    expect(texts).toContain("开做顺序");
    expect(texts).toContain("收尾上桌");
  });
});

if (!hasAutomatorRuntime && nodeTest) {
  const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
  const mealApiSource = readFileSync(resolve(__dirname, "../apis/meal.ts"), "utf8");

  nodeTest("meal assistant uses shared status plus personal unlock instead of stale regeneration", () => {
    nodeAssert.match(mealApiSource, /getCookAssistant\(planItemId: UUID\)/);
    nodeAssert.match(mealApiSource, /unlockCookAssistant\(planItemId: UUID, body:/);
    nodeAssert.match(mealApiSource, /cook-assistant\/unlock/);
    nodeAssert.match(mealApiSource, /status: CookAssistantContentStatus/);
    nodeAssert.match(mealApiSource, /unlocked: boolean/);
    nodeAssert.doesNotMatch(mealApiSource, /generateCookAssistant/);
    nodeAssert.doesNotMatch(mealApiSource, /isStale/);

    nodeAssert.match(pageSource, /cookAssistant\?\.status/);
    nodeAssert.match(pageSource, /cookAssistant(?:\.value)?\?\.unlocked/);
    nodeAssert.match(pageSource, /handleUnlockCookAssistant/);
    nodeAssert.match(pageSource, /newlyUnlocked/);
    nodeAssert.match(pageSource, /thinkingTimer/);
    nodeAssert.doesNotMatch(pageSource, /重新生成建议/);
    nodeAssert.doesNotMatch(pageSource, /实时补齐/);
    nodeAssert.doesNotMatch(pageSource, /isStale/);
    nodeAssert.doesNotMatch(pageSource, /generateCookAssistant/);
  });

  nodeTest("meal assistant loads the participant-safe cook context instead of the owner's plan list", () => {
    nodeAssert.match(pageSource, /mealApi\.getCookContext\(planItemId\.value\)/);
    nodeAssert.match(pageSource, /toMealAssistantPlan\(context\)/);
    nodeAssert.doesNotMatch(pageSource, /mealApi\.listPlans\(\{ from: planDate\.value/);
  });
}
