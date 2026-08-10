<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="我想吃" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="wish-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="wish-scroll" scroll-y :show-scrollbar="false" @scroll="handleWishScroll">
      <view class="wish-page">
        <view class="wish-hero" :style="heroStyle">
          <text class="wish-hero__eyebrow">{{ heroEyebrow }}</text>
          <text class="wish-hero__title">今天想吃什么</text>
          <text class="wish-hero__description">{{ heroDescription }}</text>
        </view>

        <view class="wish-content">
          <Login
            v-if="!sessionStore.isLoggedIn"
            title="登录后先把这一口记下来"
            description="有征集时先去当前征集，没有征集时先从一句感觉开始。"
          />

          <template v-else-if="!currentDiningGroupId">
            <view class="empty-wrap">
              <Empty title="还没有饭搭子关系" description="先去看看当前关系，再把想吃的带进今晚这顿饭。" />
            </view>

            <view class="action-row">
              <button class="primary action-row__button" @click="openDiningGroup">去看看饭搭子</button>
              <button class="secondary action-row__button" @click="openRecipe">看看我的菜谱</button>
            </view>
          </template>

          <template v-else>
            <view v-if="errorText" class="notice" @click="loadPage(true)">
              <text class="notice__text">{{ errorText }}</text>
              <text class="notice__action">重新加载</text>
            </view>

            <view v-else-if="loading" class="notice">
              <text class="notice__text">正在看今晚有没有在征集...</text>
            </view>

            <view v-if="activePoll" class="status-card">
              <view class="status-card__header">
                <view>
                  <text class="status-card__label">今晚征集中</text>
                  <text class="status-card__title">{{ activePoll.title }}</text>
                </view>
                <text class="status-card__badge">{{ formatMealSlot(activePoll.mealSlot) }}</text>
              </view>
              <view class="status-grid">
                <view class="status-grid__item">
                  <text class="status-grid__label">截止</text>
                  <text class="status-grid__value">{{ formatHourMinute(activePoll.deadlineAt) }}</text>
                </view>
                <view class="status-grid__item">
                  <text class="status-grid__label">候选菜</text>
                  <text class="status-grid__value">{{ activePoll.candidateCount }} 道</text>
                </view>
                <view class="status-grid__item">
                  <text class="status-grid__label">已回应</text>
                  <text class="status-grid__value">{{ responseProgressText }}</text>
                </view>
              </view>
            </view>

            <view class="section-card">
              <text class="section-card__title">先从一句感觉开始</text>
              <text class="section-card__description">不用先想清楚菜名，先把今天这顿饭的感觉提出来。</text>
              <view class="tone-grid">
                <view
                  v-for="item in toneOptions"
                  :key="item.value"
                  class="tone-chip"
                  :class="{ 'tone-chip--active': selectedTone === item.value }"
                  hover-class="tone-chip--hover"
                  hover-stay-time="100"
                  @click="selectedTone = item.value"
                >
                  <text class="tone-chip__title">{{ item.label }}</text>
                  <text class="tone-chip__note">{{ item.note }}</text>
                </view>
              </view>
            </view>

            <view class="section-card">
              <text class="section-card__title">这一口先怎么往前走</text>
              <text class="section-card__description">{{ selectedToneSummary }}</text>
              <view class="action-row">
                <button class="primary action-row__button" @click="openPoll">
                  {{ activePoll ? "带去当前征集" : "去点菜征集" }}
                </button>
                <button class="secondary action-row__button" @click="openRecipe">从菜谱里挑一道</button>
              </view>
            </view>

            <view class="section-card">
              <text class="section-card__title">最近提案</text>
              <view class="empty-inline">
                <text class="empty-inline__title">还没有提案记录</text>
                <text class="empty-inline__description">这轮先把入口收成场景首页，真实提案记录后续再接业务数据。</text>
              </view>
            </view>
          </template>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import { pollApi, type MealPollSummary } from "@/apis/poll";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { formatHourMinute } from "../utils/date";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();

const WISH_NAV_GAP = 16;
const WISH_NAV_FADE_DISTANCE = 96;

const toneOptions = [
  { value: "warm", label: "热乎的", note: "想吃一口刚出锅的热菜" },
  { value: "rice", label: "下饭的", note: "想配一碗饭，吃得踏实" },
  { value: "light", label: "清爽的", note: "别太重口，轻一点更舒服" },
  { value: "easy", label: "省事的", note: "别折腾，快点吃上最重要" }
] as const;

const loading = ref(false);
const errorText = ref("");
const activePoll = ref<MealPollSummary | null>(null);
const selectedTone = ref<(typeof toneOptions)[number]["value"]>("warm");
const wishScrollTop = ref(0);
let loadPromise: Promise<void> | null = null;

const currentDiningGroupId = computed(() => diningGroupStore.currentDiningGroupId);
const currentDiningGroupName = computed(() => diningGroupStore.currentDiningGroup?.name ?? "当前饭搭子");
const responseProgressText = computed(() => {
  if (!activePoll.value) return "--";
  const memberCount = diningGroupStore.currentDiningGroup?.memberCount ?? 0;
  if (!memberCount) return `${activePoll.value.responseCount} 人`;
  return `${activePoll.value.responseCount}/${memberCount} 人`;
});
const heroEyebrow = computed(() => {
  if (!sessionStore.isLoggedIn) return "晚饭提案";
  if (!currentDiningGroupId.value) return "晚饭提案";
  return currentDiningGroupName.value;
});
const heroDescription = computed(() => {
  if (!sessionStore.isLoggedIn) {
    return "先把今天这一口想法记下来，登录后再决定带去当前征集还是继续沉淀。";
  }
  if (!currentDiningGroupId.value) {
    return "先加入或创建饭搭子，再把这一口带进晚饭协商里。";
  }
  return activePoll.value
    ? `${formatMealSlot(activePoll.value.mealSlot)}正在征集，先把你这口想法带进去。`
    : "还没有晚饭征集时，先从一句感觉开始，再决定要不要带去问大家。";
});
const selectedToneSummary = computed(() => {
  const tone = toneOptions.find(item => item.value === selectedTone.value) ?? toneOptions[0];
  if (activePoll.value) {
    return `你现在偏向“${tone.label}”，可以直接带着这个方向去当前征集，少一点空想，多一点收口。`;
  }
  return `你现在偏向“${tone.label}”，可以先去点菜征集，也可以先从自己的菜谱里挑一道更具体的菜。`;
});
const navProgress = computed(() => Math.min(1, Math.max(0, wishScrollTop.value / WISH_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + WISH_NAV_GAP}px`
}));

onShow(() => {
  void loadPage();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      activePoll.value = null;
      errorText.value = "";
      loading.value = false;
    }
  }
);

watch(
  () => currentDiningGroupId.value,
  (nextId, prevId) => {
    if (nextId === prevId) return;
    activePoll.value = null;
    errorText.value = "";
    if (sessionStore.isLoggedIn && nextId) {
      void loadPage(true);
    }
  }
);

async function loadPage(force = false) {
  if (!sessionStore.isLoggedIn) return;

  if (!currentDiningGroupId.value || force) {
    try {
      await diningGroupStore.refreshCurrent();
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : "饭搭子加载失败";
    }
  }

  if (!currentDiningGroupId.value) {
    activePoll.value = null;
    return;
  }

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loading.value = true;
  errorText.value = "";
  const requestGroupId = currentDiningGroupId.value;
  loadPromise = pollApi
    .list({ diningGroupId: requestGroupId, status: "OPEN", limit: 1 })
    .then(items => {
      if (currentDiningGroupId.value !== requestGroupId) return;
      activePoll.value = items[0] ?? null;
    })
    .catch(error => {
      if (currentDiningGroupId.value !== requestGroupId) return;
      errorText.value = error instanceof Error ? error.message : "征集加载失败";
      activePoll.value = null;
    })
    .finally(() => {
      loading.value = false;
      loadPromise = null;
    });

  await loadPromise;
}

function handleWishScroll(event: { detail?: { scrollTop?: number } }) {
  wishScrollTop.value = event.detail?.scrollTop ?? 0;
}

function formatMealSlot(slot: MealPollSummary["mealSlot"]) {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  return "晚餐";
}

function openPoll() {
  void uniPlatform.navigation.navigateTo("/pages_meal/poll/index");
}

function openRecipe() {
  void uniPlatform.navigation.navigateTo("/pages/recipe/index");
}

function openDiningGroup() {
  void uniPlatform.navigation.navigateTo("/pages_restaurant/members/index");
}
</script>

<style scoped lang="scss">
.wish-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.wish-scroll {
  height: 100%;
  background: var(--color-page);
}

.wish-page {
  min-height: 100%;
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
}

.wish-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 16% 24%, rgba(255, 220, 168, 0.5), transparent 28%),
    radial-gradient(circle at 84% 18%, rgba(188, 224, 184, 0.42), transparent 26%),
    linear-gradient(145deg, rgba(255, 243, 223, 0.96), rgba(252, 249, 242, 0.98));
}

.wish-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.wish-hero__eyebrow,
.wish-hero__title,
.wish-hero__description,
.status-card__label,
.status-card__title,
.section-card__title,
.section-card__description,
.empty-inline__title,
.empty-inline__description {
  display: block;
}

.wish-hero__eyebrow,
.status-card__label {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.wish-hero__title,
.status-card__title,
.section-card__title,
.empty-inline__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.wish-hero__title {
  margin-top: 10rpx;
  font-size: 42rpx;
  line-height: 1.2;
}

.wish-hero__description,
.section-card__description,
.empty-inline__description {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.status-card,
.section-card,
.notice,
.empty-wrap,
.action-row {
  margin-top: var(--space-md);
}

.status-card,
.section-card {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-lg);
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.notice__text,
.notice__action {
  display: block;
  font-size: var(--font-size-sm);
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.status-card__header,
.status-grid,
.action-row {
  display: flex;
}

.status-card__header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.status-card__badge {
  flex: 0 0 auto;
  padding: 10rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.status-grid {
  gap: 16rpx;
  margin-top: 20rpx;
}

.status-grid__item {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.status-grid__label,
.status-grid__value,
.tone-chip__title,
.tone-chip__note {
  display: block;
}

.status-grid__label,
.tone-chip__note {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.status-grid__value {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.tone-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 20rpx;
}

.tone-chip {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.tone-chip--hover {
  transform: translateY(-4rpx);
}

.tone-chip--active {
  background: rgba(255, 235, 202, 0.78);
}

.tone-chip__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.tone-chip__note {
  margin-top: 10rpx;
}

.action-row {
  gap: 16rpx;
}

.action-row__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.empty-inline {
  margin-top: 16rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}
</style>
