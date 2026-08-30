<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="" full-screen :show-left="false" :navbar-placeholder="false" navbar-transparent>
    <template #navbar-left>
      <view class="cookfont icon-back notification-nav__back" hover-class="notification-nav__back--hover" hover-stay-time="100" @click="handleBack" />
    </template>
    <template #navbar-center>
      <text class="notification-title">通知中心</text>
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
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view class="notification-body">
            <view v-if="loading && !messageItems.length" class="notice">加载中...</view>
            <view v-else-if="errorText && !messageItems.length" class="notice notice--error" @click="loadPage()">
              {{ errorText }}
            </view>
            <view v-else-if="!messageItems.length" class="empty-block">
              <text class="empty-block__title">还没有消息</text>
              <text class="empty-block__desc">审核结果、协作动态、官方消息和系统提醒会按时间倒序显示在这里。</text>
            </view>
            <view v-else class="message-list">
              <view
                v-for="item in messageItems"
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
import { fridgeApi } from "@/apis/fridge";
import { homeApi, type HomeWeekOverview } from "@/apis/home";
import { UnauthorizedError } from "@/apis/http";
import { recipeApi, type IngredientRecommendationSummary, type UnitRecommendationSummary } from "@/apis/recipe";
import { userApi, type NotificationSettingsResponse } from "@/apis/user";
import { officialMessageApi, type OfficialMessageSummary } from "../apis/official-message";
import { shoppingApi, type ShoppingListInviteSummary } from "../apis/shopping";
import Layout from "@/components/Layout/Layout.vue";
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

interface MessageItem {
  id: string;
  typeLabel: "系统审核消息" | "系统清单协作消息" | "系统提醒消息" | "系统官方消息";
  tone: "review" | "shopping" | "reminder" | "official";
  title: string;
  desc: string;
  timeValue: string;
  timeText: string;
  targetPath: string | null;
}

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
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
const errorText = ref("");
const loadCount = ref(0);
const needLogin = ref(false);
const ingredientItems = ref<IngredientRecommendationSummary[]>([]);
const unitItems = ref<UnitRecommendationSummary[]>([]);
const shoppingInvites = ref<ShoppingListInviteSummary[]>([]);
const officialMessages = ref<OfficialMessageSummary[]>([]);
const expiringCount = ref(0);
const expiringLatestTime = ref("");
const weekOverview = ref<HomeWeekOverview | null>(null);
const notificationSettings = ref<NotificationSettingsResponse>(buildEnabledNotificationSettings());

const messageItems = computed<MessageItem[]>(() =>
  [
    ...ingredientItems.value.map(buildIngredientMessage),
    ...unitItems.value.map(buildUnitMessage),
    ...shoppingInvites.value.map(buildInviteMessage),
    ...officialMessages.value.map(buildOfficialMessage),
    ...buildReminderMessages()
  ].sort((left, right) => new Date(right.timeValue).getTime() - new Date(left.timeValue).getTime())
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

async function doLoadPage() {
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
    let resolvedSettings = buildDisabledNotificationSettings();
    let settingsLoaded = false;

    try {
      resolvedSettings = await userApi.getNotificationSettings();
      notificationSettings.value = resolvedSettings;
      settingsLoaded = true;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        showLoginState();
        loginModalStore.open(null, () => {
          needLogin.value = false;
          void loadPage();
        });
        return;
      }
      notificationSettings.value = resolvedSettings;
      errorText.value ||= error instanceof Error ? error.message : "加载失败，请重试";
    }

    const [ingredientResult, unitResult, inviteResult, officialResult, fridgeResult, weekResult] = await Promise.allSettled([
      recipeApi.listIngredientRecommendations({ page: 1, pageSize: 20 }),
      recipeApi.listUnitRecommendations({ page: 1, pageSize: 20 }),
      shoppingApi.listInvites("ALL"),
      officialMessageApi.listMessages(1, 20),
      fridgeApi.getSummary(resolvedSettings.fridge.days),
      homeApi.getWeekOverview()
    ]);

    if (hasUnauthorizedResult([ingredientResult, unitResult, inviteResult, officialResult, fridgeResult, weekResult])) {
      showLoginState();
      loginModalStore.open(null, () => {
        needLogin.value = false;
        void loadPage();
      });
      return;
    }

    if (ingredientResult.status === "fulfilled") {
      ingredientItems.value = ingredientResult.value.items;
    } else {
      ingredientItems.value = [];
      errorText.value ||= ingredientResult.reason instanceof Error ? ingredientResult.reason.message : "加载失败，请重试";
    }

    if (unitResult.status === "fulfilled") {
      unitItems.value = unitResult.value.items;
    } else {
      unitItems.value = [];
      errorText.value ||= unitResult.reason instanceof Error ? unitResult.reason.message : "加载失败，请重试";
    }

    if (inviteResult.status === "fulfilled") {
      shoppingInvites.value = inviteResult.value.items;
    } else {
      shoppingInvites.value = [];
      errorText.value ||= inviteResult.reason instanceof Error ? inviteResult.reason.message : "加载失败，请重试";
    }

    if (officialResult.status === "fulfilled") {
      officialMessages.value = officialResult.value.items;
    } else {
      officialMessages.value = [];
      errorText.value ||= officialResult.reason instanceof Error ? officialResult.reason.message : "加载失败，请重试";
    }

    if (fridgeResult.status === "fulfilled") {
      expiringCount.value = fridgeResult.value.expiringCount;
      expiringLatestTime.value = fridgeResult.value.latestTime;
    } else {
      expiringCount.value = 0;
      expiringLatestTime.value = "";
      errorText.value ||= fridgeResult.reason instanceof Error ? fridgeResult.reason.message : "加载失败，请重试";
    }

    if (weekResult.status === "fulfilled") {
      weekOverview.value = weekResult.value;
    } else {
      weekOverview.value = null;
      errorText.value ||= weekResult.reason instanceof Error ? weekResult.reason.message : "加载失败，请重试";
    }

    const allSettledSucceeded = settingsLoaded && [ingredientResult, unitResult, inviteResult, officialResult, fridgeResult, weekResult].every(
      result => result.status === "fulfilled"
    );
    if (allSettledSucceeded) {
      await markNotificationFeedRead().catch(() => null);
    }
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

function buildIngredientMessage(item: IngredientRecommendationSummary): MessageItem {
  const timeValue = item.reviewedAt || item.updatedAt || item.createdAt;
  const statusText =
    item.status === "PENDING"
      ? `“${item.ingredientName}”正在审核中`
      : item.status === "REJECTED"
        ? item.reviewNote || `“${item.ingredientName}”审核未通过`
        : item.status === "ADOPTED"
          ? `“${item.ingredientName}”已收录为系统食材`
          : `“${item.ingredientName}”已归并到现有系统食材`;

  return {
    id: `ingredient:${item.id}`,
    typeLabel: "系统审核消息",
    tone: "review",
    title: `食材审核：${item.ingredientName}`,
    desc: statusText,
    timeValue,
    timeText: formatListTime(timeValue),
    targetPath: null
  };
}

function buildUnitMessage(item: UnitRecommendationSummary): MessageItem {
  const timeValue = item.reviewedAt || item.updatedAt || item.createdAt;
  const statusText =
    item.status === "PENDING"
      ? `“${item.unitName}”正在审核中`
      : item.status === "REJECTED"
        ? item.reviewNote || `“${item.unitName}”审核未通过`
        : item.status === "ADOPTED"
          ? `“${item.unitName}”已收录为系统单位`
          : `“${item.unitName}”已归并到现有系统单位`;

  return {
    id: `unit:${item.id}`,
    typeLabel: "系统审核消息",
    tone: "review",
    title: `单位审核：${item.unitName}`,
    desc: statusText,
    timeValue,
    timeText: formatListTime(timeValue),
    targetPath: null
  };
}

function buildInviteMessage(item: ShoppingListInviteSummary): MessageItem {
  const ownerName = item.ownerNickname || `UID ${item.ownerUid}`;
  const timeValue = item.handledAt || item.invitedAt;
  const desc =
    item.inviteStatus === "ACCEPTED"
      ? `你已加入“${item.name}”，可继续和 ${ownerName} 一起维护`
      : item.inviteStatus === "DECLINED"
        ? `你已忽略 ${ownerName} 发来的“${item.name}”协作邀请`
        : item.inviteStatus === "REVOKED"
          ? `发起人已撤回“${item.name}”的协作邀请`
          : item.canJoin
            ? `${ownerName} 邀请你一起维护“${item.name}”`
            : `“${item.name}”当前协作者已满，暂时不能加入`;

  return {
    id: `invite:${item.id}`,
    typeLabel: "系统清单协作消息",
    tone: "shopping",
    title: `清单协作：${item.name}`,
    desc,
    timeValue,
    timeText: formatListTime(timeValue),
    targetPath: `/pages_pantry/list-detail/index?id=${encodeURIComponent(String(item.listId))}`
  };
}

function buildOfficialMessage(item: OfficialMessageSummary): MessageItem {
  const directUrl = resolveDirectUrl(item.bodyHtml);
  const timeValue = item.publishedAt || item.updatedAt;
  return {
    id: `official:${item.id}`,
    typeLabel: "系统官方消息",
    tone: "official",
    title: item.title,
    desc: item.summary,
    timeValue,
    timeText: formatListTime(timeValue),
    targetPath: directUrl
      ? `/pages_web/content/index?url=${encodeURIComponent(directUrl)}`
      : `/pages_me/official-message/index?messageId=${encodeURIComponent(String(item.id))}`
  };
}

function buildReminderMessages() {
  const items: MessageItem[] = [];
  const settings = notificationSettings.value;

  if (settings.fridge.enabled && expiringCount.value > 0 && expiringLatestTime.value) {
    items.push({
      id: "reminder:fridge-expiring",
      typeLabel: "系统提醒消息",
      tone: "reminder",
      title: "食材到期提醒",
      desc: expiringCount.value === 1 ? "有 1 样食材快到期，记得优先安排" : `有 ${expiringCount.value} 样食材快到期，记得优先安排`,
      timeValue: expiringLatestTime.value,
      timeText: formatListTime(expiringLatestTime.value),
      targetPath: "/pages_pantry/index/index"
    });
  }

  const overview = weekOverview.value;
  if (settings.meal.enabled && overview && overview.status !== "NO_ARRANGEMENT" && overview.status !== "COMPLETED") {
    const timeValue = overview.notificationTime || overview.arrangement?.scheduledAt || "";
    if (timeValue) {
      items.push({
        id: `reminder:week-overview:${overview.status}`,
        typeLabel: "系统提醒消息",
        tone: "reminder",
        title: "计划提醒",
        desc: overview.summary || overview.title || "你有一条近期安排待处理",
        timeValue,
        timeText: formatListTime(timeValue),
        targetPath: normalizePagePath(overview.targetValue)
      });
    }
  }

  return items;
}

function normalizePagePath(value: string) {
  if (!value) return "/pages/home/index";
  return value.startsWith("/") ? value : `/${value}`;
}

function resolveDirectUrl(bodyHtml: string) {
  const matched = bodyHtml.match(/<a\b[^>]*href=(['"])(https:\/\/[^"'<>]+)\1/i);
  return matched?.[2] ?? "";
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

function openMessage(item: MessageItem) {
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
  ingredientItems.value = [];
  unitItems.value = [];
  shoppingInvites.value = [];
  officialMessages.value = [];
  expiringCount.value = 0;
  expiringLatestTime.value = "";
  weekOverview.value = null;
  notificationSettings.value = buildEnabledNotificationSettings();
  errorText.value = "";
  needLogin.value = true;
}

function buildEnabledNotificationSettings(): NotificationSettingsResponse {
  return {
    reminderDotOnly: false,
    meal: {
      enabled: true,
      times: {
        breakfast: "08:00",
        lunch: "12:00",
        afternoonTea: "15:30",
        dinner: "18:30",
        lateNight: "21:30"
      }
    },
    fridge: {
      enabled: true,
      days: 3
    },
    recommend: {
      enabled: false
    }
  };
}

function buildDisabledNotificationSettings(): NotificationSettingsResponse {
  return {
    reminderDotOnly: false,
    meal: {
      enabled: false,
      times: {
        breakfast: "08:00",
        lunch: "12:00",
        afternoonTea: "15:30",
        dinner: "18:30",
        lateNight: "21:30"
      }
    },
    fridge: {
      enabled: false,
      days: 3
    },
    recommend: {
      enabled: false
    }
  };
}

function hasUnauthorizedResult(results: Array<PromiseSettledResult<unknown>>) {
  return results.some(result => result.status === "rejected" && result.reason instanceof UnauthorizedError);
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

function automatorReadState() {
  return {
    needLogin: needLogin.value,
    loading: loading.value,
    refreshing: refreshing.value,
    errorText: errorText.value,
    loadCount: loadCount.value,
    itemCount: messageItems.value.length,
    items: messageItems.value.map(item => ({
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
  automatorTriggerRefresh,
  automatorReadState
});
</script>

<style scoped lang="scss">
.notification-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  box-sizing: border-box;
  background: var(--page-ambient-duo-bg);
}

.notification-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.notification-scroll {
  flex: 1;
  height: 100%;
}

.notification-body {
  padding-right: var(--space-page);
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.notification-title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  text-align: center;
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

.message-list,
.empty-block {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.message-list {
  overflow: hidden;
}

.message-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: var(--space-md);
}

.message-card + .message-card {
  border-top: 1rpx solid var(--color-divider);
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
  border-radius: 999rpx;
  font-size: var(--font-size-xs);
  font-weight: 700;
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

.empty-block {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 20rpx;
  padding: 28rpx;
}

.empty-block__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.notice {
  margin-top: 20rpx;
  padding-top: 40rpx;
  text-align: center;
}

.notice--error {
  color: var(--color-support-action);
}
</style>
