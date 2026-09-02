import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(__dirname, "index.vue"), "utf8");

function expectIncludes(snippet: string) {
  assert.ok(pageSource.includes(snippet), `Expected medal page to include: ${snippet}`);
}

function expectNotIncludes(snippet: string) {
  assert.ok(!pageSource.includes(snippet), `Expected medal page not to include: ${snippet}`);
}

expectIncludes('import { onShow } from "@dcloudio/uni-app";');
expectIncludes("<scroll-view scroll-y class=\"medal-scroll\" show-scrollbar=\"false\" @scroll=\"handleScroll\">");
expectIncludes("function handleScroll(event: { detail: { scrollTop?: number } })");
expectIncludes("scrollTop.value = event.detail.scrollTop ?? 0;");
expectIncludes('class="medal-content"');
expectIncludes(":class=\"{ 'sticky-wrap--fixed': stickyFixed }\"");
expectIncludes('v-if="stickyFixed" class="sticky-spacer"');
expectIncludes('class="category-scroll"');
expectIncludes("const STICKY_TRIGGER_TOP = 260");
expectIncludes("const stickyFixed = computed(() => scrollTop.value >= STICKY_TRIGGER_TOP)");
expectIncludes("position: fixed;");
expectIncludes('"--medal-sticky-top": `${navBarTotalHeight.value}px`');

expectNotIncludes("onPageScroll((event) => {");
