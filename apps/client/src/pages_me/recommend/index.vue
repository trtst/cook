<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :show-left="false" :navbar-placeholder="false" navbar-transparent>
    <template #navbar-left>
      <view class="cookfont icon-back notification-nav__back" hover-class="notification-nav__back--hover" hover-stay-time="100" @click="handleBack" />
    </template>
    <template #navbar-center>
      <text class="notification-title">通知中心</text>
    </template>

    <view class="notification-page" :style="pageBodyStyle">
      <view v-if="loading && !messageGroups.length" class="notice">加载中...</view>
      <view v-else-if="errorText && !messageGroups.length" class="notice notice--error" @click="loadPage()">
        {{ errorText }}
      </view>
      <view v-else class="category-list">
        <view
          v-for="item in messageGroups"
          :key="item.key"
          class="category-card"
          hover-class="category-card--hover"
          hover-stay-time="100"
          @click="openType(item.key)"
        >
          <view class="category-card__icon-shell" :class="`category-card__icon-shell--${item.tone}`">
            <text class="cookfont category-card__icon" :class="item.icon" />
          </view>

          <view class="category-card__body">
            <view class="category-card__head">
              <text class="category-card__title">{{ item.name }}</text>
              <text class="category-card__time">{{ item.timeText }}</text>
            </view>

            <view class="category-card__desc-row">
              <text class="category-card__desc">{{ item.preview }}</text>
              <view v-if="item.hasUnread" class="category-card__dot" />
            </view>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { recipeApi, type IngredientRecommendationSummary } from "@/apis/recipe";
import { shoppingApi, type ShoppingListInviteSummary } from "../apis/shopping";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";

type MessageTypeKey = "ingredient" | "shoppingInvite";
type ReadState = Partial<Record<MessageTypeKey, string>>;

const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();

const messageTabs = [
  {
    key: "ingredient",
    name: "推荐审核",
    icon: "icon-recommend",
    tone: "recommend"
  },
  {
    key: "shoppingInvite",
    name: "清单协作",
    icon: "icon-shopping",
    tone: "shopping"
  }
] as const satisfies Array<{
  key: MessageTypeKey;
  name: string;
  icon: string;
  tone: "recommend" | "shopping";
}>;

const loading = ref(false);
const errorText = ref("");
const ingredientItems = ref<IngredientRecommendationSummary[]>([]);
const shoppingInvites = ref<ShoppingListInviteSummary[]>([]);
const readState = ref<ReadState>(uniPlatform.storage.getSync<ReadState>(READ_STORAGE_KEY) ?? {});

const messageGroups = computed(() =>
  messageTabs.map(item => {
    const latestTime = getLatestTime(item.key);
    return {
      ...item,
      preview: buildGroupPreview(item.key),
      timeText: latestTime ? formatListTime(latestTime) : "",
      hasUnread: Boolean(latestTime) && latestTime !== (readState.value[item.key] ?? "")
    };
  })
);
const pageBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 20}px`
}));

let loadPromise: Promise<void> | null = null;

onShow(() => {
  readState.value = uniPlatform.storage.getSync<ReadState>(READ_STORAGE_KEY) ?? {};
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

async function doLoadPage() {
  loading.value = true;
  errorText.value = "";
  try {
    const [ingredientResult, inviteResult] = await Promise.allSettled([
      recipeApi.listIngredientRecommendations({ page: 1, pageSize: 20 }),
      shoppingApi.listInvites("ALL")
    ]);

    if (ingredientResult.status === "fulfilled") {
      ingredientItems.value = ingredientResult.value.items;
    } else {
      ingredientItems.value = [];
      errorText.value ||= ingredientResult.reason instanceof Error ? ingredientResult.reason.message : "加载失败，请重试";
    }

    if (inviteResult.status === "fulfilled") {
      shoppingInvites.value = inviteResult.value.items;
    } else {
      shoppingInvites.value = [];
      errorText.value ||= inviteResult.reason instanceof Error ? inviteResult.reason.message : "加载失败，请重试";
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
    loading.value = false;
  }
}

function getItemSortTime(item: IngredientRecommendationSummary) {
  return item.reviewedAt || item.updatedAt || item.createdAt;
}

function getLatestIngredient() {
  return ingredientItems.value.reduce<IngredientRecommendationSummary | null>((latest, item) => {
    if (!latest) return item;
    return new Date(getItemSortTime(item)).getTime() > new Date(getItemSortTime(latest)).getTime() ? item : latest;
  }, null);
}

function getLatestInvite() {
  return shoppingInvites.value.reduce<ShoppingListInviteSummary | null>((latest, item) => {
    if (!latest) return item;
    return new Date(getInviteSortTime(item)).getTime() > new Date(getInviteSortTime(latest)).getTime() ? item : latest;
  }, null);
}

function getInviteSortTime(item: ShoppingListInviteSummary) {
  return item.handledAt || item.invitedAt;
}

function getLatestTime(type: MessageTypeKey) {
  if (type === "shoppingInvite") return getLatestInvite() ? getInviteSortTime(getLatestInvite() as ShoppingListInviteSummary) : "";
  return getLatestIngredient() ? getItemSortTime(getLatestIngredient() as IngredientRecommendationSummary) : "";
}

function buildGroupPreview(type: MessageTypeKey) {
  if (type === "shoppingInvite") {
    if (loading.value && !shoppingInvites.value.length) return "正在同步清单协作邀请";
    if (errorText.value && !shoppingInvites.value.length) return "邀请加载失败，点击进入后可重试";
    const latest = getLatestInvite();
    if (!latest) return "饭搭子分享给你的清单邀请会先收口到这里";
    const ownerName = latest.ownerNickname || `UID ${latest.ownerUid}`;
    if (latest.inviteStatus === "ACCEPTED") return `你已加入“${latest.name}”，可继续和 ${ownerName} 一起维护`;
    if (latest.inviteStatus === "DECLINED") return `你已忽略 ${ownerName} 发来的“${latest.name}”协作邀请`;
    if (latest.canJoin) return `${ownerName} 邀请你一起维护“${latest.name}”`;
    return `“${latest.name}”当前协作者已满，暂时不能加入`;
  }

  const item = getLatestIngredient();
  if (loading.value && !ingredientItems.value.length) return "正在同步推荐审核记录";
  if (errorText.value && !ingredientItems.value.length) return "记录加载失败，点击进入后可重试";
  if (!item) return "食材推荐审核动态会先收口到这里";
  if (item.status === "PENDING") return `“${item.ingredientName}”正在审核中`;
  if (item.status === "REJECTED") return item.reviewNote || `“${item.ingredientName}”审核未通过`;
  if (item.status === "ADOPTED") return `“${item.ingredientName}”已收录为系统食材`;
  return `“${item.ingredientName}”已归并到现有系统食材`;
}

function formatListTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function markTypeRead(type: MessageTypeKey) {
  const latestTime = getLatestTime(type);
  readState.value = {
    ...readState.value,
    [type]: latestTime
  };
  uniPlatform.storage.setSync(READ_STORAGE_KEY, readState.value);
}

function openType(type: MessageTypeKey) {
  markTypeRead(type);
  void uniPlatform.navigation.navigateTo(`/pages_me/recommend-detail/index?type=${encodeURIComponent(type)}`);
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    void uniPlatform.navigation.navigateBack();
    return;
  }
  void uniPlatform.navigation.switchTab("/pages/home/index");
}
</script>

<style scoped lang="scss">
.notification-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
  box-sizing: border-box;
  padding-right: var(--space-page);
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
  background:
    radial-gradient(circle at 14% 18%, var(--entry-side-mint-bg) 0, transparent 31%),
    radial-gradient(circle at 46% 8%, var(--entry-primary-bg) 0, transparent 24%),
    radial-gradient(circle at 78% 36%, var(--entry-side-aqua-bg) 0, transparent 28%),
    linear-gradient(154deg, var(--entry-board-bg), var(--color-page));
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

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.category-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: var(--space-md);
  background: var(--color-surface);
}

.category-card--hover {
  opacity: 0.88;
}

.category-card + .category-card {
  border-top: 1rpx solid var(--color-divider);
}

.category-card__icon-shell {
  display: flex;
  flex: 0 0 88rpx;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 20rpx;
}

.category-card__icon-shell--recommend {
  background:
    radial-gradient(circle at 18% 18%, var(--entry-side-mint-bg) 0, transparent 58%),
    radial-gradient(circle at 86% 10%, var(--entry-side-aqua-bg) 0, transparent 52%),
    linear-gradient(148deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.category-card__icon-shell--shopping {
  background:
    radial-gradient(circle at 20% 20%, var(--entry-side-aqua-bg) 0, transparent 54%),
    radial-gradient(circle at 78% 18%, rgba(255, 196, 122, 0.52) 0, transparent 50%),
    linear-gradient(148deg, var(--entry-side-mint-bg), var(--entry-board-bg));
}

.category-card__icon {
  color: #ffffff;
  font-size: 44rpx;
}

.category-card__body {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
}

.category-card__head,
.category-card__desc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.category-card__title {
  color: #1f2740;
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.category-card__time,
.category-card__desc,
.notice {
  color: #8d97b5;
  font-size: 24rpx;
  line-height: 1.6;
}

.category-card__time {
  flex: 0 0 auto;
}

.category-card__desc {
  flex: 1;
  min-width: 0;
}

.category-card__dot {
  flex: 0 0 auto;
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #ff5d66;
}

.notice {
  padding-top: 40rpx;
  text-align: center;
}

.notice--error {
  color: var(--color-primary);
}
</style>
