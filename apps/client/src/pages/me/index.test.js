jest.setTimeout(30000);

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

describe("pages/me/index", () => {
  let page;

  beforeAll(async () => {
    await clearSession();
    page = await program.reLaunch("/pages/me/index");
    await page.waitFor(".service-row__title", 8000);
  });

  it("我的页维持通知中心后紧跟勋章且会员入口默认隐藏", async () => {
    expect(await page.path).toBe("pages/me/index");

    const serviceTitles = await collectTexts(await page.$$(".service-row__title"));
    expect(serviceTitles.slice(0, 5)).toEqual(["通知中心", "我的勋章", "我的口味", "食材与单位", "厨具"]);
    expect(serviceTitles).not.toContain("权益中心");
    expect(serviceTitles).not.toContain("会员兑换码");
    expect(serviceTitles).not.toContain("我的会员");

    const overviewGrids = await page.$$(".overview-grid");
    expect(overviewGrids).toHaveLength(0);
  });

  it("未登录点击我的勋章会呼起全局登录弹窗并可切到手机号验证码表单", async () => {
    await page.callMethod("automatorOpenMedalLogin");

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
});
