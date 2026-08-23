const { createMealAssistantFixture } = require("../../test-utils/meal-assistant-fixture.js");

jest.setTimeout(30000);

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
    expect(state.hasSnapshot).toBe(false);
    expect(state.assistantStatusText).toBe("未生成");
    expect(state.actionLabel).toBe("生成做饭建议");

    const texts = await collectTexts(page);
    expect(texts).toContain("这桌吃什么");
    expect(texts).toContain("先整理这桌菜，再开始做饭");
    expect(texts).toContain(fixture.paidGeneratedRecipe.title);
    expect(texts).toContain(fixture.paidMissingRecipe.title);
  });

  it("做饭助手页可以生成真实建议并展示补洞后的结果", async () => {
    const state = await page.callMethod("automatorGenerateCookAssistant");
    expect(state.hasSnapshot).toBe(true);
    expect(state.prepTaskCount).toBeGreaterThan(0);
    expect(state.timelineStepCount).toBeGreaterThan(0);
    expect(state.noteTexts.some((item) => item.includes("已为1道缺少建议的菜实时补齐单菜做饭建议"))).toBe(true);
    expect(state.actionLabel).toBe("按建议开始做饭");

    const texts = await collectTexts(page);
    expect(texts).toContain("前期准备");
    expect(texts).toContain("开做顺序");
    expect(texts).toContain("收尾上桌");
  });
});
