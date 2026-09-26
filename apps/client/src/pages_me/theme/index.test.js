jest.setTimeout(30000);

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
}

async function collectTexts(nodes) {
  const values = [];
  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) values.push(value);
  }
  return values;
}

describe("pages_me/theme/index", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages_me/theme/index");
    await page.waitFor(".theme-card__title", 8000);
  });

  beforeEach(async () => {
    await page.callMethod("automatorClearSession");
    await page.callMethod("automatorResetThemeSettings");
  });

  it("保留主题和色系入口并默认选中，同时支持显示模式切换", async () => {
    expect(await page.path).toBe("pages_me/theme/index");

    const texts = await collectTexts(await page.$$("text"));
    expect(texts).toContain("主题设置");
    expect(texts).toContain("当前主题");
    expect(texts).toContain("可选默认、暖橙和冰川蓝色系");
    expect(texts).toContain("主题");
    expect(texts).toContain("色系");
    expect(texts).toContain("模式");
    expect(texts).toContain("TabBar 预览");

    const sectionTitles = await collectTexts(await page.$$(".theme-card__section-title"));
    expect(sectionTitles).toEqual(["主题", "色系", "模式"]);

    const state = await page.callMethod("automatorReadState");
    expect(state.themeMode).toBe("system");
    expect(state.effectiveSkin).toBe("default");
    expect(state.effectivePalette).toBe("default");
    expect(state.currentThemeFamily).toBe("default");
    expect(state.currentSchemeValue).toBe("default");
    expect(state.currentModeValue).toBe("system");
    expect(state.themeOptions).toEqual(["default"]);
    expect(state.themeOptionLabels).toEqual(["默认主题"]);
    expect(state.showSchemeCard).toBe(true);
    expect(state.showModeCard).toBe(true);
    expect(state.schemeOptionLabels).toEqual(["默认", "暖橙", "冰川蓝"]);
    expect(state.themeModeOptions).toEqual(["system", "light", "dark"]);
    expect(state.currentThemeText).toBe("默认主题 · 默认 · 跟随系统");
  });

  it("未登录更改模式只做预览，登录后确认才保存", async () => {
    const preview = await page.callMethod("automatorSetThemeMode", "dark");
    expect(preview.themeMode).toBe("dark");
    expect(preview.persistedThemeSkin).toBe("default");
    expect(preview.loginModalVisible).toBe(false);

    const pending = await page.callMethod("automatorConfirmThemeSelection");
    expect(pending.themeMode).toBe("dark");
    expect(pending.persistedThemeSkin).toBe("default");
    expect(pending.loginModalVisible).toBe(true);

    const saved = await page.callMethod("automatorApplyThemeLoginSuccess");
    expect(saved.themeMode).toBe("dark");
    expect(saved.persistedThemeSkin).toBe("default");
    expect(saved.loginModalVisible).toBe(false);
  });

  it("未确认离开主题页时会回滚模式预览", async () => {
    await page.callMethod("automatorSetThemeMode", "light");
    const rolledBack = await page.callMethod("automatorSimulateLeave");
    expect(rolledBack.themeMode).toBe("system");
    expect(rolledBack.effectiveSkin).toBe("default");
    expect(rolledBack.effectivePalette).toBe("default");
  });
});
