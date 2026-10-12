import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const pageSource = readFileSync(resolve(currentDir, "index.vue"), "utf8");
const pagesSource = readFileSync(resolve(currentDir, "../../pages.json"), "utf8");
const topicPageSource = readFileSync(resolve(currentDir, "../topic/index.vue"), "utf8");
const homeApiSource = readFileSync(resolve(currentDir, "../../apis/home.ts"), "utf8");

function selectorBlock(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);
  return match[1];
}

assert.match(pagesSource, /"path":\s*"topic-list\/index"/);
assert.match(pageSource, /homeApi\.getTopicHistory\(nextPage, PAGE_SIZE\)/);
assert.match(pageSource, /@scrolltolower="loadNextPage"/);
assert.match(pageSource, /history-state--error" @click="retryHistory"/);
assert.match(pageSource, /function retryHistory\(\)\s*\{\s*void loadHistory\(\);\s*\}/);
assert.match(pageSource, /hasNext\.value/);
assert.match(pageSource, /items\.value\s*=\s*reset\s*\?\s*result\.items\s*:\s*\[\.\.\.items\.value, \.\.\.result\.items\]/);
assert.match(pageSource, /v-for="item in items"/);
assert.match(pageSource, /openTopic\(item\.id\)/);
assert.match(pageSource, /\/pages_home\/topic\/index\?topicId=\$\{encodeURIComponent\(String\(topicId\)\)\}&historyBrowse=1/);
assert.match(topicPageSource, /@click="openHistoryList"/);
assert.match(topicPageSource, /navigateTo\("\/pages_home\/topic-list\/index"\)/);
assert.match(topicPageSource, /historyBrowse\.value\s*\?\s*uniPlatform\.navigation\.redirectTo/);
assert.match(topicPageSource, /historyBrowse\.value\s*=\s*rawHistoryBrowse\s*===\s*"1"/);
assert.match(topicPageSource, /[?&]historyBrowse=1/);
assert.match(homeApiSource, /getTopicHistory\(page: number, pageSize: number\)/);
assert.match(homeApiSource, /\/api\/home-topics\/history\?page=\$\{encodeURIComponent\(String\(page\)\)\}&pageSize=\$\{encodeURIComponent\(String\(pageSize\)\)\}/);
assert.match(topicPageSource, /gap:\s*24rpx/);

const topicBackdropStyles = selectorBlock(topicPageSource, ".topic-backdrop");
assert.match(topicBackdropStyles, /bottom:\s*0;/);
assert.doesNotMatch(topicBackdropStyles, /height:\s*760rpx/);

const topicSectionStyles = selectorBlock(topicPageSource, ".topic-section");
assert.match(topicSectionStyles, /background:\s*color-mix\(in srgb, var\(--color-page\) 30%, transparent\);/);

console.log("往期周刊列表前端路由与接口静态契约通过");
