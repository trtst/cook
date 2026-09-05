import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const cropConfigSource = readFileSync(resolve(__dirname, "../utils/image-crop.ts"), "utf8");

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected source to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected source to exclude: ${snippet}`);
}

function selectorBody(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);
  return match[1];
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const body = selectorBody(source, selector);
  for (const snippet of snippets) {
    assert.ok(body.includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

function expectSelectorExcludes(source: string, selector: string, snippets: string[]) {
  const body = selectorBody(source, selector);
  for (const snippet of snippets) {
    assert.ok(!body.includes(snippet), `Expected selector ${selector} to exclude: ${snippet}`);
  }
}

function expectOccurrence(source: string, snippet: string, count: number) {
  const matches = source.match(new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
  assert.equal(matches.length, count, `Expected ${snippet} to appear ${count} time(s), got ${matches.length}`);
}

expectExcludes(pageSource, "crop-nav-backdrop");
expectExcludes(pageSource, "navBackdropStyle");
expectIncludes(pageSource, 'type="2d"');
expectIncludes(pageSource, ':id="currentCanvasId"');
expectExcludes(pageSource, "createCanvasContext");
expectIncludes(pageSource, "getCanvas2d");
expectIncludes(pageSource, 'v-if="cropTip"');
expectIncludes(pageSource, "cropRequest.value?.tip ?? \"\"");
expectIncludes(pageSource, "const tipHeight = cropTip.value ? rpxToPx(TIP_RPX) : 0;");
expectIncludes(pageSource, "return rpxToPx(ACTIONS_RPX) + ratioHeight + tipHeight + safeAreaBottom.value;");
expectExcludes(pageSource, "建议突出成品主体，画面尽量简洁完整。");
expectExcludes(pageSource, "建议保留关键步骤主体，避免内容太贴边。");

expectIncludes(pageSource, "const CROP_PAGE_BG = \"#101010\";");
expectIncludes(pageSource, "const CROP_NAV_COLOR = \"#ffffff\";");
expectOccurrence(pageSource, "#101010", 1);
expectOccurrence(pageSource, "#ffffff", 1);
expectExcludes(pageSource, ':navbar-background-color="CROP_PAGE_BG"');
expectExcludes(pageSource, ':navbar-foreground-color="CROP_NAV_COLOR"');
expectIncludes(pageSource, "background-color: ${CROP_PAGE_BG};");
expectIncludes(pageSource, "backgroundColor: CROP_PAGE_BG");
expectSelectorIncludes(pageSource, ".crop-page", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ".crop-stage", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ".crop-state", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ".crop-box", ["border: 2rpx solid var(--crop-nav-color);"]);
expectSelectorExcludes(pageSource, ".crop-box", ["box-shadow"]);
expectSelectorIncludes(pageSource, ".crop-box__handle--lt", ["top: 0;", "left: 0;"]);
expectSelectorIncludes(pageSource, ".crop-box__handle--rt", ["top: 0;", "right: 0;"]);
expectSelectorIncludes(pageSource, ".crop-box__handle--lb", ["bottom: 0;", "left: 0;"]);
expectSelectorIncludes(pageSource, ".crop-box__handle--rb", ["right: 0;", "bottom: 0;"]);
expectSelectorExcludes(pageSource, ".crop-box__handle--lt", ["-22rpx"]);
expectSelectorExcludes(pageSource, ".crop-box__handle--rt", ["-22rpx"]);
expectSelectorExcludes(pageSource, ".crop-box__handle--lb", ["-22rpx"]);
expectSelectorExcludes(pageSource, ".crop-box__handle--rb", ["-22rpx"]);
expectSelectorIncludes(pageSource, ".crop-tip", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ".crop-actions", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ":global(.crop-layout)", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ":global(.crop-layout .layout__theme)", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ":global(.crop-layout .layout__body)", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ":global(.crop-layout .navbar__fixed),\n:global(.crop-layout .navbar__fixed--transparent)", ["background: var(--crop-page-bg);"]);
expectSelectorIncludes(pageSource, ":global(.crop-layout .navbar__title),\n:global(.crop-layout .navbar__icon)", ["color: var(--crop-nav-color);"]);
expectSelectorIncludes(pageSource, ".crop-actions__button--light", ["background: var(--button-secondary-bg);", "color: var(--button-secondary-text);"]);
expectSelectorIncludes(pageSource, ".crop-actions__button--primary", ["background: var(--button-primary-bg);", "color: var(--button-primary-text);"]);
expectSelectorExcludes(pageSource, ".crop-actions__button--primary", ["feedback-line-danger"]);
expectExcludes(pageSource, "--crop-editor-bg");
expectExcludes(pageSource, "var(--color-overlay-text)");

expectIncludes(cropConfigSource, "tip?: string;");
expectIncludes(cropConfigSource, 'tip: "建议突出成品主体，画面尽量简洁完整。"');
expectExcludes(cropConfigSource, 'profileAvatar: {\n    title: "裁剪头像",\n    tip:');
