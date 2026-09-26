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

  it("首页只使用默认主题和默认色系，旧设置回到默认", async () => {
    const defaultState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "default",
      themePalette: "default",
      themeMode: "system"
    });
    expect(defaultState.effectiveSkin).toBe("default");
    expect(defaultState.effectivePalette).toBe("default");
    expect(defaultState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(defaultState.colorPage).toBe("#fff");
    expect(defaultState.themePageStyle).toContain("background-color: #fff;");
    expect(defaultState.materialCardBorder).toBe("transparent");
    expect(defaultState.materialInputBorder).toBe("rgba(33, 110, 78, 0.08)");
    expect(defaultState.materialControlBorder).toBe("transparent");
    expect(defaultState.materialTabbarBorder).toBe("transparent");
    expect(defaultState.buttonSecondaryBorder).toBe("transparent");

    const oldSettingsState = await page.callMethod("automatorApplyThemeSettings", {
      themeSkin: "apple-glass",
      themePalette: "sprout"
    });
    expect(oldSettingsState.effectiveSkin).toBe("default");
    expect(oldSettingsState.effectivePalette).toBe("default");
    expect(oldSettingsState.currentThemeText).toBe("跟随系统 · 默认主题");
    expect(oldSettingsState.colorPage).toBe("#fff");
  });
});
