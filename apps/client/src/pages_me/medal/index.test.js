const { createMedalFixture } = require("../../test-utils/medal-fixture.js");

jest.setTimeout(30000);

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

describe("pages_me/medal/index", () => {
  let page;
  let fixture;

  beforeAll(async () => {
    fixture = await createMedalFixture();
    await clearSession();
    page = await program.reLaunch("/pages_me/medal/index");
    await page.callMethod("automatorApplySession", {
      token: fixture.ownerSession.token,
      uid: fixture.ownerSession.user.uid,
      expiresAt: fixture.ownerSession.expiresAt
    });
    await page.waitFor(".hero-card__title", 8000);
  });

  it("勋章墙页可以展示真实标题、分类和获得状态", async () => {
    expect(await page.path).toBe("pages_me/medal/index");

    const state = await page.callMethod("automatorReadWallState");
    expect(state.title).toBe("我的勋章");
    expect(state.slogan).toBe("认真做饭，也值得被记录");
    expect(state.earnedCount).toBeGreaterThanOrEqual(4);

    const categoryNames = state.categories.map((item) => item.name);
    expect(categoryNames).toContain("全部");
    expect(categoryNames).toContain("开饭打卡");
    expect(categoryNames).toContain("饭局协作");
    expect(categoryNames).toContain("节假日限定");

    const mealItem = state.items.find((item) => item.code === fixture.templates.meal.code);
    const eventItem = state.items.find((item) => item.code === fixture.templates.event.code);
    const fullLoopItem = state.items.find((item) => item.code === fixture.templates.fullLoop.code);
    const lockedItem = state.items.find((item) => item.code === fixture.templates.locked.code);
    const hiddenItem = state.items.find((item) => item.code === fixture.templates.hidden.code);

    expect(mealItem).toMatchObject({
      name: fixture.templates.meal.name,
      earned: true,
      categoryName: "开饭打卡",
      state: "已点亮"
    });
    expect(eventItem).toMatchObject({
      name: fixture.templates.event.name,
      earned: true,
      categoryName: "饭局协作",
      state: "已点亮"
    });
    expect(fullLoopItem).toMatchObject({
      name: fixture.templates.fullLoop.name,
      earned: true,
      categoryName: "开饭打卡",
      state: "已点亮"
    });
    expect(lockedItem).toMatchObject({
      name: fixture.templates.locked.name,
      earned: false,
      categoryName: "节假日限定",
      state: "待点亮"
    });
    expect(hiddenItem).toBeUndefined();

    const texts = await collectTexts(page);
    expect(texts).toContain("我的勋章");
    expect(texts).toContain("认真做饭，也值得被记录");
    expect(texts).toContain("开饭打卡");
    expect(texts).toContain("饭局协作");
    expect(texts).toContain("节假日限定");
    expect(texts).toContain(fixture.templates.meal.name);
    expect(texts).toContain(fixture.templates.locked.name);
  });

  it("勋章墙页可以切换真实分类并只显示对应勋章", async () => {
    await page.callMethod("automatorChangeCategory", "DINING_COLLABORATION");
    const collaborationState = await page.callMethod("automatorReadWallState");
    expect(collaborationState.activeCategory).toBe("DINING_COLLABORATION");
    expect(collaborationState.items.length).toBeGreaterThanOrEqual(2);
    collaborationState.items.forEach((item) => {
      expect(item.category).toBe("DINING_COLLABORATION");
    });
    expect(collaborationState.items.some((item) => item.code === fixture.templates.event.code)).toBe(true);
    expect(collaborationState.items.some((item) => item.code === fixture.templates.group.code)).toBe(true);

    await page.callMethod("automatorChangeCategory", "HOLIDAY_LIMITED");
    const limitedState = await page.callMethod("automatorReadWallState");
    expect(limitedState.activeCategory).toBe("HOLIDAY_LIMITED");
    expect(limitedState.items.some((item) => item.code === fixture.templates.locked.code)).toBe(true);
    expect(limitedState.items.some((item) => item.code === fixture.templates.meal.code)).toBe(false);
  });
});
