<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="notification-nav-title">通知中心</text>
    </template>
    <view class="notification-page" :style="pageBodyStyle">
      <view class="notification-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          scroll-y
          class="notification-scroll"
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
          <view class="notification-body">
            <view v-if="loading && !messageItems.length" class="notice">加载中...</view>
            <view v-else-if="errorText && !messageItems.length" class="notice notice--error" @click="loadPage()">
              {{ errorText }}
            </view>
            <Empty v-else-if="!messageItems.length" :art="emptyStateArt" title="暂无通知" description="重要消息，将在这里呈现。" />
            <view v-else class="message-list">
              <view
                v-for="item in displayItems"
                :key="item.id"
                class="message-card"
                hover-class="message-card--hover"
                hover-stay-time="100"
                @click="openMessage(item)"
              >
                <view class="message-card__head">
                  <text class="message-card__type" :class="`message-card__type--${item.tone}`">{{ item.typeLabel }}</text>
                  <text class="message-card__time">{{ item.timeText }}</text>
                </view>
                <text class="message-card__title">{{ item.title }}</text>
                <text class="message-card__desc">{{ item.desc }}</text>
              </view>
              <view v-if="errorText" class="notice notice--error notice--inline" @click="loadPage()">
                {{ errorText }}
              </view>
              <LoadMore v-if="loadingMore || hasNext" :loading="loadingMore" :has-next="hasNext" />
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
import { UnauthorizedError } from "@/apis/http";
import { userApi, type NotificationFeedItem } from "@/apis/user";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { markNotificationFeedRead } from "@/services/notification-badge";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { restoreAppSession } from "@/utils/session";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
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
    pulling: "下拉刷新消息",
    canRelease: ["松手刷新消息", "更新通知列表"],
    success: "消息已刷新"
  }
});

const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const loadCount = ref(0);
const needLogin = ref(false);
const page = ref(1);
const pageSize = ref(10);
const hasNext = ref(false);
const messageItems = ref<NotificationFeedItem[]>([]);
const displayItems = computed(() =>
  messageItems.value.map(item => ({
    ...item,
    timeText: formatListTime(item.timeValue)
  }))
);

const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));

let loadPromise: Promise<void> | null = null;

onShow(() => {
  void loadPage();
});

async function loadPage() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = doLoadPage().finally(() => {
    loadPromise = null;
  });

  await loadPromise;
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadPage();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

async function handleScrollToLower() {
  if (!hasNext.value) return;
  await loadMore();
}

async function doLoadPage() {
  await restoreAppSession();

  if (!sessionStore.isLoggedIn) {
    showLoginState();
    loginModalStore.open(null, () => {
      needLogin.value = false;
      void loadPage();
    });
    return;
  }

  loading.value = true;
  needLogin.value = false;
  errorText.value = "";
  loadCount.value += 1;
  try {
    const result = await userApi.getNotificationFeed({
      page: 1,
      pageSize: pageSize.value
    });
    page.value = result.page;
    hasNext.value = result.hasNext;
    messageItems.value = result.items;
    await markNotificationFeedRead().catch(() => null);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLoginState();
      loginModalStore.open(null, () => {
        needLogin.value = false;
        void loadPage();
      });
      return;
    }
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (!hasNext.value || loading.value || loadingMore.value) return;
  loadingMore.value = true;
  errorText.value = "";

  try {
    const result = await userApi.getNotificationFeed({
      page: page.value + 1,
      pageSize: pageSize.value
    });
    page.value = result.page;
    hasNext.value = result.hasNext;
    messageItems.value = [...messageItems.value, ...result.items];
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLoginState();
      loginModalStore.open(null, () => {
        needLogin.value = false;
        void loadPage();
      });
      return;
    }
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
    loadingMore.value = false;
  }
}

function formatListTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function openMessage(item: NotificationFeedItem) {
  if (!item.targetPath) return;
  if (item.targetPath.includes("/pages/home/index")) {
    void uniPlatform.navigation.switchTab("/pages/home/index");
    return;
  }
  void uniPlatform.navigation.navigateTo(item.targetPath);
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }
  void uniPlatform.navigation.switchTab("/pages/home/index");
}

function showLoginState() {
  loadingMore.value = false;
  page.value = 1;
  hasNext.value = false;
  messageItems.value = [];
  errorText.value = "";
  needLogin.value = true;
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  await loadPage();
}

async function automatorTriggerRefresh() {
  onRefresherPulling({
    detail: {
      dy: refresherThreshold
    }
  });
  await handleRefresherRefresh();
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  showLoginState();
}

function automatorReadState() {
  return {
    needLogin: needLogin.value,
    loading: loading.value,
    loadingMore: loadingMore.value,
    refreshing: refreshing.value,
    errorText: errorText.value,
    loadCount: loadCount.value,
    itemCount: displayItems.value.length,
    hasNext: hasNext.value,
    items: displayItems.value.map(item => ({
      id: item.id,
      typeLabel: item.typeLabel,
      title: item.title,
      desc: item.desc,
      timeText: item.timeText,
      targetPath: item.targetPath
    }))
  };
}

defineExpose({
  automatorApplySession,
  automatorClearSession,
  automatorTriggerRefresh,
  automatorReadState,
  loadMore
});
</script>

<style scoped lang="scss">
.notification-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  background: var(--page-ambient-duo-bg);
}

.notification-nav-title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-scroll-wrap {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.notification-scroll {
  flex: 1;
  min-height: 0;
}

.notification-body {
  padding-right: var(--space-page);
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.notification-nav__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  line-height: 1;
}

.notification-nav__back--hover {
  opacity: 0.68;
}

.message-list {
  display: flex;
  flex-direction: column;
}

.message-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: var(--space-md);
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.message-card + .message-card {
  margin-top: 16rpx;
}

.message-card--hover {
  opacity: 0.88;
}

.message-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.message-card__type {
  display: inline-flex;
  align-items: center;
  min-height: 40rpx;
  padding: 0 16rpx;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.message-card__type--review {
  color: var(--color-state-warning-text);
  background: var(--color-state-warning-soft);
}

.message-card__type--shopping {
  color: var(--color-tag-secondary-text);
  background: var(--color-tag-secondary-bg);
}

.message-card__type--reminder {
  color: var(--color-state-danger-text);
  background: var(--color-state-danger-soft);
}

.message-card__type--official {
  color: var(--color-tag-primary-text);
  background: var(--color-tag-primary-bg);
}

.message-card__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
}

.message-card__time,
.message-card__desc,
.notice,
.empty-block__desc {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notice {
  margin-top: 20rpx;
  padding-top: 40rpx;
  text-align: center;
}

.notice--error {
  color: var(--color-support-action);
}

.notice--inline {
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 24rpx;
}

</style>
