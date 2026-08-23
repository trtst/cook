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

async function openDetail(session, code) {
  await clearSession();
  const page = await program.reLaunch(`/pages_me/medal-detail/index?code=${encodeURIComponent(code)}`);
  await page.callMethod("automatorApplySession", {
    token: session.token,
    uid: session.user.uid,
    expiresAt: session.expiresAt
  });
  await page.waitFor(".hero-card__name", 8000);
  return page;
}

describe("pages_me/medal-detail/index", () => {
  let fixture;

  beforeAll(async () => {
    fixture = await createMedalFixture();
  });

  it("勋章详情页可以展示真实已获得状态并打开说明", async () => {
    const page = await openDetail(fixture.ownerSession, fixture.templates.meal.code);
    expect(await page.path).toBe("pages_me/medal-detail/index");

    const state = await page.callMethod("automatorReadDetailState");
    expect(state.title).toBe(fixture.templates.meal.name);
    expect(state.categoryName).toBe("开饭打卡");
    expect(state.earned).toBe(true);
    expect(state.statusText).toBe("已点亮");
    expect(state.statusHint).toContain("获得于");
    expect(state.earnedAtText).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);

    await page.callMethod("automatorOpenNotice");
    const noticeState = await page.callMethod("automatorReadDetailState");
    expect(noticeState.noticeVisible).toBe(true);

    const texts = await collectTexts(page);
    expect(texts).toContain(fixture.templates.meal.name);
    expect(texts).toContain("获取条件");
    expect(texts).toContain("所属类别");
    expect(texts).toContain("当前状态");
    expect(texts).toContain(fixture.templates.meal.condition);
    expect(texts).toContain("开饭打卡");
  });

  it("未获得勋章详情页会明确显示尚未获得", async () => {
    const page = await openDetail(fixture.ownerSession, fixture.templates.locked.code);
    const state = await page.callMethod("automatorReadDetailState");

    expect(state.title).toBe(fixture.templates.locked.name);
    expect(state.categoryName).toBe("节假日限定");
    expect(state.earned).toBe(false);
    expect(state.statusText).toBe("待点亮");
    expect(state.statusHint).toBe("达成条件后自动点亮");

    const texts = await collectTexts(page);
    expect(texts.some((item) => item.includes("尚未获得"))).toBe(true);
    expect(texts).toContain(fixture.templates.locked.name);
    expect(texts).toContain("节假日限定");
  });
});
