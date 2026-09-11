<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="最近看过">
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
            <view v-if="(loading || !loaded) && !items.length" class="history-list">
              <view v-for="index in 4" :key="index" class="history-card">
                <view class="history-card__cover">
                  <Skeleton width="280rpx" height="210rpx" radius="var(--radius-xs)" />
                </view>
                <view class="history-card__main history-card__main--skeleton">
                  <view class="history-card__title">
                    <Skeleton width="72%" height="32rpx" radius="8rpx" />
                  </view>
                  <Skeleton width="120rpx" height="24rpx" radius="8rpx" />
                  <Skeleton width="80%" height="24rpx" radius="8rpx" />
                </view>
              </view>
            </view>
            <view v-else-if="errorText && !items.length" class="notice notice--error" @click="loadPage(true)">
              {{ errorText }}
            </view>
            <view v-else-if="!items.length" class="history-empty-state">
              <Empty
                :art="emptyStateArt"
                title="还没有浏览记录"
                description="去菜谱里逛逛，看过的菜谱会在这里留下足迹。"
              />
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
                hover-class="history-card--pressed"
                hover-stay-time="100"
                @click="openItem(item)"
              >
                <view class="history-card__cover">
                  <image v-if="item.coverImageUrl" class="history-card__image" :src="item.coverImageUrl" mode="aspectFill" />
                  <ImageEmpty v-else class="history-card__image history-card__image--empty" copy="封面图" ratio="fill" />
                </view>
                <view class="history-card__main">
                  <text class="history-card__title">{{ item.title }}</text>
                  <text class="history-card__source">{{ sourceText(item.sourceType) }}</text>
                  <text class="history-card__time">{{ formatViewTime(item.lastViewedAt) }}</text>
                </view>
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
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeSecond } from "@/utils/date";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
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
const loaded = ref(false);
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
  if (loading.value || loadingMore.value) return false;

  if (reset) loading.value = true;
  else loadingMore.value = true;
  errorText.value = "";

  try {
    const query: RecipeViewHistoryQuery = {
      page: reset ? 1 : page.value + 1,
      pageSize: pageSize.value
    };
    let result = await recipeApi.listRecipeViewHistory(query);
    if (!sessionStore.isLoggedIn) return false;
    // 失效记录仍占接口分页，跳过没有可展示菜谱的页。
    while (result.hasNext && !result.items.some(item => item.isAvailable)) {
      query.page = result.page + 1;
      result = await recipeApi.listRecipeViewHistory(query);
      if (!sessionStore.isLoggedIn) return false;
    }
    if (!sessionStore.isLoggedIn) return false;
    const availableItems = result.items.filter(item => item.isAvailable);
    items.value = reset ? availableItems : [...items.value, ...availableItems];
    page.value = result.page;
    pageSize.value = result.pageSize;
    hasNext.value = result.hasNext;
    if (!reset) loadedMoreOnce.value = true;
    return true;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "最近看过加载失败";
    return false;
  } finally {
    loaded.value = true;
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
.history-card {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice {
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

.history-empty-state {
  display: flex;
  min-height: 520rpx;
  align-items: flex-start;
  justify-content: center;
}

.history-empty-state :deep(.empty-state) {
  width: 100%;
  margin-top: 48rpx;
  padding-top: 0;
  padding-bottom: 0;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-page);
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
}

.history-card--pressed {
  opacity: 0.82;
}

.history-card__cover {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 280rpx;
  height: 210rpx;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.history-card__image {
  width: 100%;
  height: 100%;
}

.history-card__main {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 210rpx;
  min-width: 0;
  padding: var(--space-md);
}

.history-card__title {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-card__main--skeleton {
  gap: 10rpx;
}

.history-card__source,
.history-card__time {
  flex-shrink: 0;
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

</style>
