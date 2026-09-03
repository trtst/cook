import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFile(relativePath: string) {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

function expectIncludes(source: string, snippet: string) {
  assert.ok(source.includes(snippet), `Expected file to include: ${snippet}`);
}

function expectExcludes(source: string, snippet: string) {
  assert.ok(!source.includes(snippet), `Expected file to exclude: ${snippet}`);
}

function expectSelectorExcludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(!match[1].includes(snippet), `Expected selector ${selector} to exclude: ${snippet}`);
  }
}

function expectSelectorIncludes(source: string, selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

const pageSource = readFile("index.vue");
const articleBodySource = readFile("../components/ArticleBody.vue");
const fontSource = readFile("../../assets/fonts/font.scss");
const bannedProcessName = ["norm", "alize"].join("");
const readLabel = ["阅", "读"].join("");
const likeLabel = ["点", "赞"].join("");

expectIncludes(fontSource, '.icon-time::before {\n    content: "\\e665";\n}');
expectIncludes(fontSource, '.icon-read::before {\n    content: "\\e6df";\n}');
expectIncludes(fontSource, '.icon-like::before {\n    content: "\\e6f9";\n}');
expectIncludes(pageSource, 'class="detail-meta__icon cookfont icon-time"');
expectIncludes(pageSource, 'class="detail-meta__icon cookfont icon-read"');
expectIncludes(pageSource, 'class="detail-meta__icon cookfont icon-like"');
expectIncludes(pageSource, 'class="detail-bottom-like"');
expectIncludes(pageSource, 'class="detail-bottom-like__button"');
expectIncludes(pageSource, "import ArticleBody from");
expectIncludes(pageSource, "<ArticleBody :html=\"detail.bodyHtml\" />");
expectIncludes(pageSource, "if (!detail.value || viewRecorded.value || !sessionStore.isLoggedIn) return;");
expectExcludes(pageSource, readLabel);
expectExcludes(pageSource, likeLabel);
expectExcludes(pageSource, bannedProcessName);
expectExcludes(articleBodySource, bannedProcessName);
expectIncludes(articleBodySource, "class=\"article-body\"");
expectIncludes(articleBodySource, ":nodes=\"articleHtml\"");
expectIncludes(articleBodySource, "buildArticleHtml");
expectExcludes(pageSource, 'class="detail-toolbar"');

const coverIndex = pageSource.indexOf('class="detail-cover');
const titleIndex = pageSource.indexOf('class="detail-title"');
const metaIndex = pageSource.indexOf('class="detail-meta"');
const summaryIndex = pageSource.indexOf('class="detail-summary"');
const keywordsIndex = pageSource.indexOf('class="detail-keywords"');
const articleIndex = pageSource.indexOf('class="detail-article"');
const bottomLikeIndex = pageSource.indexOf('class="detail-bottom-like"');

assert.ok(coverIndex >= 0, "Expected cover section");
assert.ok(titleIndex > coverIndex, "Expected title after cover");
assert.ok(metaIndex > titleIndex, "Expected time/read/like meta after title");
assert.ok(summaryIndex > metaIndex, "Expected summary after meta");
assert.ok(keywordsIndex > summaryIndex, "Expected keywords after summary");
assert.ok(articleIndex > keywordsIndex, "Expected article body after keywords");
assert.ok(bottomLikeIndex > articleIndex, "Expected centered bottom like after article body");

expectSelectorExcludes(pageSource, ".detail-article", [
  "border-radius:",
  "background:",
  "box-shadow:"
]);

expectSelectorIncludes(pageSource, ".detail-meta__item--active", [
  "color: var(--color-support-action);",
  "font-weight: var(--font-weight-semibold);"
]);
expectSelectorIncludes(pageSource, ".detail-summary", [
  "padding: 8rpx 18rpx;",
  "background: var(--color-surface-soft-panel);"
]);
expectSelectorExcludes(pageSource, ".detail-keyword", [
  "background: var(--color-surface-muted);"
]);
expectSelectorIncludes(articleBodySource, ".article-body__rich", [
  "display: block;",
  "font-size: 32rpx;",
  "line-height: 2;"
]);
expectSelectorIncludes(articleBodySource, ".article-body", [
  "display: block;",
  "color: var(--color-text);"
]);
expectSelectorIncludes(pageSource, ".detail-bottom-like", [
  "display: flex;",
  "justify-content: center;"
]);
expectSelectorIncludes(pageSource, ".detail-bottom-like__button", [
  "border: 1rpx solid var(--color-border);",
  "border-radius: var(--radius-pill);"
]);
expectSelectorIncludes(pageSource, ".detail-bottom-like__button--active", [
  "border-color: var(--color-border-active);",
  "color: var(--color-support-action);"
]);
expectSelectorIncludes(pageSource, ".detail-navbar__title", [
  "display: block;",
  "width: 100%;",
  "overflow: hidden;",
  "text-align: left;",
  "text-overflow: ellipsis;",
  "white-space: nowrap;"
]);
