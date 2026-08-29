const fs = require("fs");
const path = require("path");

jest.setTimeout(30000);

const OUTPUT_DIR = "/private/tmp/cook-theme-visual";

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function clearThemeSettings() {
  await program.callUniMethod("removeStorageSync", "cook_meal_theme");
}

async function captureCurrentPage(fileName) {
  const outputPath = path.join(OUTPUT_DIR, fileName);
  await program.screenshot({
    path: outputPath,
    fullPage: true
  });
  expect(fs.existsSync(outputPath)).toBe(true);
  return outputPath;
}

describe("pages_me/theme visual capture", () => {
  let page;

  beforeAll(async () => {
    ensureOutputDir();
    await clearThemeSettings();
    page = await program.reLaunch("/pages_me/theme/index");
    await page.waitFor(".theme-page", 8000);
    await page.callMethod("automatorResetThemeSettings");
  });

  it.skip("导出主题页的关键皮肤截图（HBuilderX CLI App.captureScreenshot 不稳定，保留为手工留档候选）", async () => {
    const captured = {};

    await page.callMethod("automatorResetThemeSettings");
    captured.default = await captureCurrentPage("theme-default.png");

    await page.callMethod("automatorSetThemeSkin", "minimal-white");
    await page.waitFor(300);
    captured.minimalWhite = await captureCurrentPage("theme-minimal-white.png");

    await page.callMethod("automatorSetThemeSkin", "apple-glass");
    await page.waitFor(300);
    captured.appleGlass = await captureCurrentPage("theme-apple-glass.png");

    console.log(JSON.stringify(captured, null, 2));
  });
});
