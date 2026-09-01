<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="最近看过">
    <template v-if="!sessionStore.isLoggedIn">
      <view class="recipe-history-login">
        <LoginEmptyState
          title="登录后查看最近看过的菜谱"
          description="登录后，你最近看过的菜谱会在这里按时间留下。"
          @success="handleLoginSuccess"
        />
      </view>
    </template>

    <view v-else class="history-page">
      <view class="history-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          scroll-y
          class="history-scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          :lower-threshold="120"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
          @scrolltolower="handleScrollToLower"
        >
          <view class="history-body">
            <view v-if="loading && !items.length" class="notice">加载中...</view>
            <view v-else-if="errorText && !items.length" class="notice notice--error" @click="loadPage(true)">
              {{ errorText }}
            </view>
            <view v-else-if="!items.length" class="history-empty">
              <text class="history-empty__title">还没有看过菜谱</text>
              <text class="history-empty__desc">去菜谱里看看，最近浏览过的内容会在这里留下。</text>
            </view>
            <view v-else class="history-list">
              <view v-if="errorText" class="inline-notice" @click="loadPage(true)">
                <text>{{ errorText }}</text>
                <text class="inline-notice__action">重试</text>
              </view>

              <view
                v-for="item in items"
                :key="item.id"
                class="history-card"
                :class="{ 'history-card--unavailable': !item.isAvailable }"
                hover-class="history-card--pressed"
                hover-stay-time="100"
                @click="openItem(item)"
              >
                <view class="history-card__cover">
                  <image v-if="item.coverImageUrl" class="history-card__image" :src="item.coverImageUrl" mode="aspectFill" />
                  <text v-else class="cookfont icon-recipe history-card__placeholder" aria-hidden="true" />
                </view>
                <view class="history-card__main">
                  <text class="history-card__title">{{ item.title }}</text>
                  <text class="history-card__source">{{ sourceText(item.sourceType) }}</text>
                  <text class="history-card__time">最近查看 {{ formatViewTime(item.lastViewedAt) }}</text>
                </view>
                <text v-if="item.isAvailable" class="cookfont icon-back history-card__arrow" />
              </view>

              <LoadMore
                :loading="loadingMore"
                :has-next="hasNext"
                :show-done="loadedMoreOnce && !hasNext"
                next-text="继续上拉，查看更多"
                done-text="已经翻到底啦"
              />
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { recipeApi, type RecipeViewHistoryItem, type RecipeViewHistoryQuery } from "@/apis/recipe";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeSecond } from "@/utils/date";

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新最近看过",
    canRelease: ["松手刷新记录", "更新最近看过"],
    success: "最近看过已刷新"
  }
});

const items = ref<RecipeViewHistoryItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const page = ref(1);
const pageSize = ref(20);
const hasNext = ref(false);
const loadedMoreOnce = ref(false);

onShow(() => {
  if (sessionStore.isLoggedIn) void loadPage(true);
});

async function handleLoginSuccess() {
  await loadPage(true);
}

async function loadPage(reset = true) {
  if (!sessionStore.isLoggedIn) return false;
  if (reset ? loading.value : loadingMore.value) return false;

  if (reset) loading.value = true;
  else loadingMore.value = true;
  errorText.value = "";

  try {
    const query: RecipeViewHistoryQuery = {
      page: reset ? 1 : page.value + 1,
      pageSize: pageSize.value
    };
    const result = await recipeApi.listRecipeViewHistory(query);
    if (!sessionStore.isLoggedIn) return false;
    items.value = reset ? result.items : [...items.value, ...result.items];
    page.value = result.page;
    pageSize.value = result.pageSize;
    hasNext.value = result.hasNext;
    if (!reset) loadedMoreOnce.value = true;
    return true;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "最近看过加载失败";
    return false;
  } finally {
    if (reset) loading.value = false;
    else loadingMore.value = false;
  }
}

function handleScrollToLower() {
  if (hasNext.value) void loadPage(false);
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadPage(true);
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

function sourceText(sourceType: RecipeViewHistoryItem["sourceType"]) {
  return sourceType === "MY" ? "我的菜谱" : "灵感菜谱";
}

function formatViewTime(value: string) {
  return formatDateTimeSecond(value, "刚刚");
}

function openItem(item: RecipeViewHistoryItem) {
  if (!item.isAvailable || !item.recipeId) return;
  void uniPlatform.navigation.navigateTo(
    `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.recipeId))}&kind=${item.sourceType === "MY" ? "my" : "inspiration"}`
  );
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  await loadPage(true);
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  items.value = [];
  page.value = 1;
  hasNext.value = false;
  errorText.value = "";
}

async function automatorTriggerRefresh() {
  await loadPage(true);
}

async function automatorLoadMore() {
  await loadPage(false);
}

function automatorReadState() {
  return {
    loginEntryVisible: !sessionStore.isLoggedIn,
    loading: loading.value,
    loadingMore: loadingMore.value,
    errorText: errorText.value,
    itemCount: items.value.length,
    hasNext: hasNext.value,
    firstItem: items.value[0]
      ? {
          title: items.value[0].title,
          sourceType: items.value[0].sourceType,
          isAvailable: items.value[0].isAvailable
        }
      : null
  };
}

defineExpose({
  automatorApplySession,
  automatorClearSession,
  automatorTriggerRefresh,
  automatorLoadMore,
  automatorReadState
});
</script>

<style scoped lang="scss">
.history-page,
.history-scroll-wrap,
.history-scroll {
  height: 100%;
  min-height: 0;
}

.history-scroll-wrap {
  position: relative;
}

.history-scroll {
  box-sizing: border-box;
}

.history-body {
  min-height: 100%;
  padding: var(--space-page) var(--space-page) calc(var(--space-page) + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.notice,
.history-empty,
.history-card {
  border-radius: var(--radius-md);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice,
.history-empty {
  padding: var(--space-lg);
  text-align: center;
}

.notice {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.notice--error,
.inline-notice__action {
  color: var(--color-support-action);
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-sm);
}

.history-empty__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.history-empty__desc {
  margin-top: 12rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.inline-notice {
  display: flex;
  justify-content: space-between;
  padding: 0 8rpx 4rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.history-card {
  display: flex;
  align-items: center;
  min-height: 156rpx;
  padding: 18rpx;
}

.history-card--pressed {
  opacity: 0.82;
}

.history-card--unavailable {
  opacity: 0.66;
}

.history-card__cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 148rpx;
  height: 116rpx;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.history-card__image {
  width: 100%;
  height: 100%;
}

.history-card__placeholder {
  color: var(--color-text-tertiary);
  font-size: 42rpx;
}

.history-card__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin-left: var(--space-md);
}

.history-card__title {
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-card__source,
.history-card__time {
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.history-card__arrow {
  margin-left: 12rpx;
  color: var(--color-text-tertiary);
  font-size: 26rpx;
  line-height: 1;
  transform: rotate(180deg);
}
</style>
