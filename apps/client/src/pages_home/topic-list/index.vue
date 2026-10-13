<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="history-nav-title" :style="navTitleStyle">往期周刊</text>
    </template>
    <view class="history-nav-backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="history-scroll" :show-scrollbar="false" @scroll="handleScroll" @scrolltolower="loadNextPage">
      <view class="history-page" :style="pagePaddingStyle">
        <view v-if="loading && !items.length" class="history-state">加载中...</view>
        <view v-else-if="errorText" class="history-state history-state--error" @click="retryHistory">{{ errorText }}</view>
        <view v-else-if="!items.length" class="history-empty" :style="emptyStyle">
          <Empty :art="emptyStateArt" title="还没有往期周刊" description="新的周刊发布后，会在这里留下记录。" />
        </view>
        <view v-else class="history-list">
          <view
            v-for="item in items"
            :key="item.id"
            class="history-card"
            hover-class="history-card--hover"
            hover-stay-time="100"
            @click="openTopic(item.id)"
          >
            <image v-if="item.coverImageUrl" class="history-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
            <ImageEmpty v-else class="history-card__cover history-card__cover--empty" copy="封面图" ratio="fill" />
            <view class="history-card__body">
              <view class="history-card__meta">
                <text class="history-card__issue">第 {{ item.issueNo }} 期</text>
              </view>
              <text class="history-card__title">{{ item.title }}</text>
              <text v-if="item.subTitle" class="history-card__subtitle">{{ item.subTitle }}</text>
              <text class="history-card__count">{{ formatWeekRange(item) }}</text>
            </view>
            <text class="history-card__arrow">›</text>
          </view>
          <view v-if="loading" class="history-more">加载中...</view>
          <view v-else-if="moreErrorText" class="history-more history-more--error" @click="loadNextPage">{{ moreErrorText }}，点此重试</view>
          <view v-else-if="hasNext" class="history-more">上拉加载更多</view>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Empty from "@/components/Empty/Empty.vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { homeApi, type HomeTopicHistoryItem } from "@/apis/home";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import emptyStateArt from "@/assets/empty.png";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const NAV_FADE_DISTANCE = 96;
const loading = ref(false);
const errorText = ref("");
const moreErrorText = ref("");
const items = ref<HomeTopicHistoryItem[]>([]);
const scrollTop = ref(0);
const page = ref(0);
const hasNext = ref(false);
const PAGE_SIZE = 20;

const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`,
  transform: `translateY(${(1 - navProgress.value) * 8}rpx)`
}));
const pagePaddingStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 28rpx)`
}));
const emptyStyle = computed(() => ({
  minHeight: `calc(100vh - ${navBarTotalHeight.value}px - 28rpx)`
}));

onLoad(() => {
  void loadHistory();
});

async function loadHistory(reset = true) {
  if (loading.value) return;
  const nextPage = reset ? 1 : page.value + 1;
  loading.value = true;
  if (reset) errorText.value = "";
  else moreErrorText.value = "";
  try {
    const result = await homeApi.getTopicHistory(nextPage, PAGE_SIZE);
    items.value = reset ? result.items : [...items.value, ...result.items];
    page.value = result.page;
    hasNext.value = result.hasNext;
  } catch (error) {
    const message = error instanceof Error ? error.message : "加载往期周刊失败";
    if (reset) errorText.value = message;
    else moreErrorText.value = message;
  } finally {
    loading.value = false;
  }
}

function loadNextPage() {
  if (!hasNext.value || loading.value) return;
  void loadHistory(false);
}

function retryHistory() {
  void loadHistory();
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openTopic(topicId: number) {
  void uniPlatform.navigation.navigateTo(`/pages_home/topic/index?topicId=${encodeURIComponent(String(topicId))}&historyBrowse=1`);
}

function formatWeekRange(item: HomeTopicHistoryItem) {
  return `${formatDateLabel(item.periodStartDate)} ～ ${formatDateLabel(item.periodEndDate)}`;
}

function formatDateLabel(value: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}.${match[2]}` : value;
}
</script>

<style scoped lang="scss">
.history-scroll {
  height: 100%;
  background: var(--color-page);
}

.history-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  transition: opacity 180ms ease;
}

.history-nav-title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease, transform 180ms ease;
}

.history-page {
  min-height: 100vh;
  padding-right: var(--space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background: var(--page-secondary-soft-bg);
}

.history-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  color: var(--color-text-secondary);
  box-shadow: var(--material-card-shadow);
}

.history-state--error {
  color: var(--color-state-danger-text);
}

.history-empty {
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.history-empty :deep(.empty-state) {
  width: 100%;
  margin-top: 48rpx;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.history-more {
  padding: 14rpx 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  text-align: center;
}

.history-more--error {
  color: var(--color-state-danger-text);
}

.history-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 188rpx;
  padding: 16rpx;
  border-radius: var(--radius-lg);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.history-card--hover {
  transform: translateY(-3rpx);
  box-shadow: var(--shadow-floating);
}

.history-card__cover {
  flex: none;
  width: 196rpx;
  height: 147rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.history-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-cover-empty-warm-bg);
}

.history-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
  padding-right: 22rpx;
}

.history-card__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.history-card__issue {
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.history-card__count {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.history-card__title {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-card__subtitle {
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-card__arrow {
  position: absolute;
  right: 20rpx;
  color: var(--color-text-tertiary);
  font-size: 34rpx;
}
</style>
