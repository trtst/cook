jest.setTimeout(30000);

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

describe("pages/home/index theme runtime", () => {
  let page;

  beforeAll(async () => {
    await clearThemeSettings();
    page = await program.reLaunch("/pages/home/index");
    await page.waitFor(".table-page", 8000);
    await page.callMethod("automatorResetThemeSettings");
  });

  it("首页默认跟随清新食材主题，并在切换后同步更新页面壳层背景", async () => {
    const defaultState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "default",
      themePalette: "default",
      themeMode: "system"
    });
    expect(defaultState.effectiveSkin).toBe("default");
    expect(defaultState.effectivePalette).toBe("default");
    expect(defaultState.currentThemeText).toBe("跟随系统 · 默认主题 · 默认");
    expect(defaultState.colorPage).toBe("#f4f7f5");
    expect(defaultState.themePageStyle).toContain("background-color: #f4f7f5;");
    expect(defaultState.materialCardBorder).toBe("transparent");
    expect(defaultState.materialInputBorder).toBe("rgba(33, 110, 78, 0.08)");
    expect(defaultState.materialControlBorder).toBe("transparent");
    expect(defaultState.materialTabbarBorder).toBe("transparent");
    expect(defaultState.buttonSecondaryBorder).toBe("transparent");

    const minimalState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "minimal-white"
    });
    expect(minimalState.effectiveSkin).toBe("minimal-white");
    expect(minimalState.effectivePalette).toBe("default");
    expect(minimalState.currentThemeText).toBe("跟随系统 · 简白");
    expect(minimalState.colorPage).toBe("#ffffff");
    expect(minimalState.themePageStyle).toContain("background-color: #ffffff;");
    expect(minimalState.materialCardBorder).toBe("transparent");
    expect(minimalState.materialInputBorder).toBe("rgba(125, 163, 91, 0.08)");
    expect(minimalState.materialControlBorder).toBe("transparent");
    expect(minimalState.materialTabbarBorder).toBe("transparent");
    expect(minimalState.buttonSecondaryBorder).toBe("transparent");

    const glassState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "apple-glass"
    });
    expect(glassState.effectiveSkin).toBe("apple-glass");
    expect(glassState.currentThemeText).toBe("跟随系统 · 磨砂玻璃");
    expect(glassState.colorPage).toBe("#eef1f4");
    expect(glassState.themePageStyle).toContain("background-color: #eef1f4;");
    expect(glassState.materialCardBorder).toBe("transparent");
    expect(glassState.materialInputBorder).toBe("rgba(255, 255, 255, 0.42)");
    expect(glassState.materialControlBorder).toBe("transparent");
    expect(glassState.materialTabbarBorder).toBe("transparent");
    expect(glassState.buttonSecondaryBorder).toBe("transparent");

    const warmState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "default",
      themePalette: "warm"
    });
    expect(warmState.effectiveSkin).toBe("default");
    expect(warmState.effectivePalette).toBe("warm");
    expect(warmState.currentThemeText).toBe("跟随系统 · 默认主题 · 暖黄");
    expect(warmState.colorPage).toBe("#fbf4e5");
    expect(warmState.themePageStyle).toContain("background-color: #fbf4e5;");
    expect(warmState.materialCardBorder).toBe("transparent");
    expect(warmState.materialInputBorder).toBe("rgba(214, 122, 84, 0.08)");
    expect(warmState.materialControlBorder).toBe("transparent");
    expect(warmState.materialTabbarBorder).toBe("transparent");
    expect(warmState.buttonSecondaryBorder).toBe("transparent");
  });
});
