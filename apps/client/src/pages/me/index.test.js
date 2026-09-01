jest.setTimeout(30000);

async function clearSession() {
  await program.callUniMethod("removeStorageSync", "cook_meal_session");
  await program.callUniMethod("removeStorageSync", "cook_meal_user_profile");
  await program.callUniMethod("removeStorageSync", "cook_meal_notification_badge_v1");
}

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

async function collectTexts(nodes) {
  const values = [];

  for (const node of nodes) {
    const value = (await node.text()).trim();
    if (value) values.push(value);
  }

  return values;
}

describe("pages/me/index", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    await clearThemeSettings();
    page = await program.reLaunch("/pages/me/index");
    await page.waitFor(".service-row__title", 8000);
    await page.callMethod("automatorClearSession");
    await page.callMethod("automatorResetThemeSettings");
  });

  it("我的页维持通知中心后紧跟勋章且会员入口默认隐藏", async () => {
    expect(await page.path).toBe("pages/me/index");

    const serviceTitles = await collectTexts(await page.$$(".service-row__title"));
    expect(serviceTitles.slice(0, 5)).toEqual(["通知中心", "我的勋章", "最近看过", "我的口味", "食材与单位"]);
    expect(serviceTitles).not.toContain("厨具");
    expect(serviceTitles).not.toContain("权益中心");
    expect(serviceTitles).not.toContain("会员兑换码");
    expect(serviceTitles).not.toContain("我的会员");

    const overviewGrids = await page.$$(".overview-grid");
    expect(overviewGrids).toHaveLength(0);

    expect(await page.$$(".quick-entry__icon")).toHaveLength(0);
    expect(await page.$$(".service-row__icon")).toHaveLength(0);
    expect(await page.$$(".knowledge-entry__icon")).toHaveLength(0);
  });

  it("通知中心入口和 TabBar 的我的都支持展示未读数或提醒红点", async () => {
    await page.callMethod("automatorApplyNotificationBadgeSnapshot", {
      unreadCount: 3,
      reminderUnreadCount: 1,
      showReminderDot: false
    });
    await page.waitFor(".service-row__badge-count", 2000);
    await page.waitFor(".tabbar__badge", 2000);
    expect((await (await page.$(".service-row__badge-count")).text()).trim()).toBe("3");
    expect((await (await page.$(".tabbar__badge")).text()).trim()).toBe("3");

    await page.callMethod("automatorApplyNotificationBadgeSnapshot", {
      unreadCount: 0,
      reminderUnreadCount: 2,
      showReminderDot: true
    });
    await page.waitFor(".service-row__badge-dot", 2000);
    await page.waitFor(".tabbar__dot", 2000);
  });

  it("未登录点击我的勋章只呼起登录，不直接跳详情页", async () => {
    expect(await page.callMethod("automatorOpenMedalLogin")).toEqual({ path: null });

    const modalState = await page.callMethod("automatorReadLoginModalState");
    expect(modalState.visible).toBe(true);
    expect(modalState.mode).toBe("wechat");
  });

  it("未登录点击通知中心会呼起全局登录弹窗并可切到手机号验证码表单", async () => {
    expect(await page.callMethod("automatorOpenNotificationLogin")).toEqual({ path: null });

    const modalState = await page.callMethod("automatorReadLoginModalState");
    expect(modalState.visible).toBe(true);
    expect(modalState.mode).toBe("wechat");
    expect(modalState.openedInMiniProgram).toBe(true);
    expect(modalState.appName).toBe("炊火记");
    expect(modalState.slogan).toBe("炊烟晚，人归缓，烟火暖流年");
    expect(modalState.wechatButtonText).toBe("微信一键登录");
    expect(modalState.switchText).toBe("手机号验证码登录");

    await page.callMethod("automatorSwitchLoginModalPhoneMode");
    const phoneState = await page.callMethod("automatorReadLoginModalState");
    expect(phoneState.visible).toBe(true);
    expect(phoneState.mode).toBe("phone");
    expect(phoneState.phoneTitle).toBe("手机号验证码登录");
    expect(phoneState.phoneDescription).toBe("请输入手机号并获取验证码后登录。");
    expect(phoneState.backText).toBe("返回微信一键登录");
    expect(phoneState.phoneSubmitText).toBe("手机号登录");
    expect(phoneState.codeButtonText).toBe("发送验证码");
  });

  it("未登录时通知中心、我的口味、最近看过、提醒设置、我的勋章和账号设置都在入口层拦登录", async () => {
    expect(await page.callMethod("automatorResolveEntryAuth", "通知中心")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "我的口味")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "最近看过")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "提醒设置")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "我的勋章")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "账号设置")).toEqual({ found: true, requiresLogin: true });
    expect(await page.callMethod("automatorResolveEntryAuth", "饭局")).toEqual({ found: true, requiresLogin: false });
    expect(await page.callMethod("automatorResolveEntryAuth", "计划")).toEqual({ found: true, requiresLogin: false });
    expect(await page.callMethod("automatorResolveEntryAuth", "购物清单")).toEqual({ found: true, requiresLogin: false });
    expect(await page.callMethod("automatorResolveEntryAuth", "食材")).toEqual({ found: true, requiresLogin: false });
  });

  it("我的页的主题摘要和页面底色会跟随主题切换同步更新", async () => {
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
