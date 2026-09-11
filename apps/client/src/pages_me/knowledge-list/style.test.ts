import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");
const readLabel = ["阅", "读"].join("");
const likeLabel = ["点", "赞"].join("");

function expectIncludes(snippet: string) {
  assert.ok(pageSource.includes(snippet), `Expected knowledge-list page to include: ${snippet}`);
}

function expectExcludes(snippet: string) {
  assert.ok(!pageSource.includes(snippet), `Expected knowledge-list page to exclude: ${snippet}`);
}

function expectSelectorIncludes(selector: string, snippets: string[]) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pageSource.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  assert.ok(match?.[1], `Expected selector block to exist: ${selector}`);

  for (const snippet of snippets) {
    assert.ok(match[1].includes(snippet), `Expected selector ${selector} to include: ${snippet}`);
  }
}

const thumbIndex = pageSource.indexOf('class="knowledge-item__thumb');
const bodyIndex = pageSource.indexOf('class="knowledge-item__body"');
const titleIndex = pageSource.indexOf('class="knowledge-item__title"', bodyIndex);
const summaryIndex = pageSource.indexOf('class="knowledge-item__summary"', bodyIndex);
const keywordsIndex = pageSource.indexOf('class="knowledge-item__keywords"', bodyIndex);
const metaIndex = pageSource.indexOf('class="knowledge-item__meta-row"', bodyIndex);

assert.ok(thumbIndex >= 0, "Expected cover before article content");
assert.ok(bodyIndex > thumbIndex, "Expected article content below cover");
assert.ok(titleIndex > bodyIndex, "Expected title below cover");
assert.ok(summaryIndex > titleIndex, "Expected summary below title");
assert.ok(keywordsIndex > summaryIndex, "Expected keywords below summary");
assert.ok(metaIndex > keywordsIndex, "Expected meta row below keywords");

expectIncludes('class="knowledge-item__meta-icon cookfont icon-time"');
expectIncludes('class="knowledge-item__meta-icon cookfont icon-read"');
expectIncludes('class="knowledge-item__meta-icon cookfont icon-like"');
expectIncludes('import ImageEmpty from "@/components/ImageEmpty.vue";');
expectIncludes('<ImageEmpty v-else class="knowledge-item__thumb knowledge-item__thumb--empty" copy="封面图" ratio="16-9" />');
expectIncludes('import emptyStateArt from "@/assets/empty.png";');
expectIncludes('<Empty\n            v-else-if="!articles.length"\n            class="knowledge-empty"\n            :art="emptyStateArt"');
expectIncludes('title="内容尚未发布"');
expectIncludes('description="关于一日三餐的做法、搭配与灵感，会在这里持续更新。"');
expectExcludes('            plain\n            title="还没有文章"');
expectExcludes('class="knowledge-item__thumb-text"');
expectExcludes(readLabel);
expectExcludes(likeLabel);
expectIncludes("const serverChannel = ref<");
expectIncludes("const channelMeta = computed(() => serverChannel.value ?? staticChannelMeta.value)");
expectIncludes("title: result.channel.name");
expectIncludes("description: result.channel.description");
expectIncludes(':style="{ opacity: navbarTitleOpacity }"');
expectIncludes("@scroll=\"handleScroll\"");
expectIncludes("const { navBarTotalHeight } = useSystemInfo()");
expectIncludes("const KNOWLEDGE_LIST_TOP = 180");
expectIncludes("const NAVBAR_TITLE_FADE_DISTANCE = 96");
expectIncludes("const navbarTitleOpacity = computed(() =>");
expectIncludes("scrollTop.value + navBarTotalHeight.value");
expectSelectorIncludes(".knowledge-item", ["flex-direction: column;"]);
expectExcludes('class="knowledge-hero__eyebrow"');
expectExcludes(".knowledge-hero__eyebrow");
expectSelectorIncludes(".knowledge-item:last-child", ["border-bottom: 0;"]);
expectSelectorIncludes(".knowledge-item__thumb", ["width: 100%;", "aspect-ratio: 16 / 9;"]);
