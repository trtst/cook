jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

describe("pages_meal/random/index theme runtime", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages_meal/random/index");
    await page.waitFor(".random-page", 8000);
    await page.callMethod("automatorClearSession");
    await page.callMethod("automatorResetThemeSettings");
  });

  it("随机页的主题摘要和页面底色会跟随主题切换同步更新", async () => {
    const defaultState = await page.callMethod("automatorReadThemeState");
    expect(defaultState.currentThemeText).toBe("跟随系统 · 默认主题 · 默认");
    expect(defaultState.colorPage).toBe("#fff");
    expect(defaultState.themePageStyle).toContain("background-color: #fff;");

    const minimalState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "minimal-white"
    });
    expect(minimalState.currentThemeText).toBe("跟随系统 · 简白");
    expect(minimalState.colorPage).toBe("#ffffff");
    expect(minimalState.themePageStyle).toContain("background-color: #ffffff;");

    const glassState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "apple-glass"
    });
    expect(glassState.currentThemeText).toBe("跟随系统 · 磨砂玻璃");
    expect(glassState.colorPage).toBe("#eef1f4");
    expect(glassState.themePageStyle).toContain("background-color: #eef1f4;");

    const warmState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "default",
      themePalette: "warm"
    });
    expect(warmState.currentThemeText).toBe("跟随系统 · 默认主题 · 暖黄");
    expect(warmState.colorPage).toBe("#fbf4e5");
    expect(warmState.themePageStyle).toContain("background-color: #fbf4e5;");
  });
});
