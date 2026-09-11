import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "./index.vue"), "utf8");

assert.ok(
  source.includes("paddingTop: `${navBarTotalHeight.value + 12}px`"),
  "Expected notification page top padding to follow the +12px page baseline."
);
assert.ok(source.includes('title=""'), "Expected notification page to keep an empty Layout title.");
assert.ok(source.includes(':class="themeClasses"'), "Expected notification page Layout host to carry theme classes.");
assert.ok(source.includes("<template #navbar-center>"), "Expected notification navbar to render its title through a page-owned center slot.");
assert.ok(source.includes("notification-nav-title"), "Expected notification navbar title to have a local style hook.");
assert.ok(!source.includes("paddingTop: `${navBarTotalHeight.value + 20}px`"), "Expected legacy +20px top padding to be removed.");
assert.ok(source.includes(".notification-page {\n  display: flex;"), "Expected notification page to keep a flex layout.");
assert.ok(source.includes("height: 100%;"), "Expected notification page to occupy the full available height for scrolling.");
assert.ok(!source.includes("min-height: 100%;"), "Expected legacy min-height based notification layout to be removed.");
assert.ok(source.includes(".notification-scroll-wrap {\n  position: relative;\n  display: flex;"), "Expected notification scroll wrapper to be a flex container.");
assert.ok(source.includes(".notification-scroll {\n  flex: 1;"), "Expected notification scroll view to consume remaining height.");
assert.ok(source.includes("min-height: 0;"), "Expected notification scroll chain to explicitly allow shrinking for scrolling.");

function expectIncludes(snippet: string) {
  assert.ok(source.includes(snippet), `Expected notification page to include: ${snippet}`);
}

function expectExcludes(snippet: string) {
  assert.ok(!source.includes(snippet), `Expected notification page to exclude: ${snippet}`);
}

expectIncludes('import emptyStateArt from "@/assets/empty.png";');
expectIncludes('<Empty v-else-if="!messageItems.length" :art="emptyStateArt" title="暂无通知" description="重要消息，将在这里呈现。" />');
expectIncludes("const pageSize = ref(10);");
expectIncludes('<LoadMore v-if="loadingMore || hasNext" :loading="loadingMore" :has-next="hasNext" />');
expectExcludes('已经翻到底啦');
expectExcludes('.message-list {\n  overflow: hidden;\n  border-radius:');
expectIncludes('.message-card {\n  display: flex;\n  flex-direction: column;\n  gap: 12rpx;\n  padding: var(--space-md);\n  border-radius: var(--radius-xs);\n  background: var(--material-card-bg);');
expectIncludes('.message-list {\n  display: flex;\n  flex-direction: column;\n  gap: var(--space-page);');
expectExcludes('.message-card + .message-card {\n  margin-top: 16rpx;');
expectIncludes('<text v-if="item.tone === \'official\'" class="cookfont icon-self-recommend message-card__type-icon" />');
expectIncludes('{{ item.typeLabel }}');
expectExcludes('function formatTypeLabel(item: NotificationFeedItem) {');
expectIncludes('if (!item.targetPath || item.tone === "official" || item.tone === "review") return;');
expectIncludes('.message-card__type-icon {');
expectIncludes('<text class="message-card__time">{{ item.timeText }}</text>\n                  <view v-if="item.isUnread" class="message-card__unread" />');
expectIncludes('.message-card__unread {\n  flex: 0 0 auto;\n  width: 12rpx;\n  height: 12rpx;\n  border-radius: 50%;');
expectIncludes('import { onHide, onShow } from "@dcloudio/uni-app";');
expectIncludes('void markUnreadFeedOnLeave(beforeTime);');
expectIncludes('await markNotificationBadgeSeen();');
expectIncludes('await markNotificationRead(item);');
expectIncludes('let feedEntryCaptured = false;');
expectIncludes('if (!feedEntryCaptured) {\n      feedEntryTime = result.items[0]?.timeValue ?? "";\n      feedEntryCaptured = true;\n    }');
expectIncludes('feedEntryCaptured = false;');

console.log("recommend page style passed");
