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

  it.skip("导出默认主题的明暗模式截图（HBuilderX CLI App.captureScreenshot 不稳定，保留为手工留档候选）", async () => {
    const captured = {};

    await page.callMethod("automatorResetThemeSettings");
    captured.default = await captureCurrentPage("theme-default.png");

    await page.callMethod("automatorSetThemeMode", "dark");
    await page.waitFor(300);
    captured.dark = await captureCurrentPage("theme-default-dark.png");

    console.log(JSON.stringify(captured, null, 2));
  });
});
