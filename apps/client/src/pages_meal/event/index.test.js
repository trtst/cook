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

  beforeAll(async () => {
    await clearSession();
    page = await program.reLaunch("/pages_meal/event/index");
    await page.waitFor(1500);
  });

  it("饭局页可以在 mp-weixin 自动化里完成基础挂载 smoke", async () => {
    expect(await page.path).toBe("pages_meal/event/index");

    const texts = await collectTexts(page);
    expect(texts).toContain("日期");
    expect(texts).toContain("餐次");
    expect(texts).toContain("时间");
  });
});
