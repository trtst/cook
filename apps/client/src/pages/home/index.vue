<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    current-tab="home"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
    navbar-layout="custom-left"
  >
    <template #navbar-left>
      <view class="table-nav__selector">
        <text class="restaurant-bar__label">当前安排</text>
        <text class="restaurant-bar__name">{{ restaurantName }}</text>
      </view>
    </template>
    <view class="home-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="table-scroll" scroll-y :show-scrollbar="false" @scroll="handleHomeScroll">
      <view class="table-page">
        <view class="table-hero" :style="heroStyle">
          <view class="hero-main">
            <view class="hero-copy">
              <text class="hero-copy__eyebrow">{{ heroEyebrow }}</text>
              <text class="hero-copy__title">{{ heroTitle }}</text>
              <text class="hero-copy__description">{{ heroDescription }}</text>
              <view class="hero-copy__actions">
                <view class="hero-copy__button hero-copy__button--primary" @click="triggerHeroPrimaryAction">
                  <text class="hero-copy__button-text">{{ heroPrimaryActionText }}</text>
                </view>
                <view
                  v-if="heroSecondaryActionText"
                  class="hero-copy__button hero-copy__button--ghost"
                  @click="triggerHeroSecondaryAction"
                >
                  <text class="hero-copy__button-text hero-copy__button-text--ghost">{{ heroSecondaryActionText }}</text>
                </view>
              </view>
            </view>

            <view class="table-scene">
              <view class="table-scene__cloth" />
              <view class="table-scene__plate">
                <view class="table-scene__rice" />
                <view class="table-scene__leaf table-scene__leaf--left" />
                <view class="table-scene__leaf table-scene__leaf--right" />
                <view class="table-scene__egg" />
              </view>
              <view class="table-scene__bowl" />
              <view class="table-scene__cup" />
            </view>
          </view>
        </view>

        <view class="table-content">
          <view v-if="hasFeatureEntries" class="feature-board">
            <view class="feature-card feature-card--main" hover-class="feature-card--hover" hover-stay-time="100" @click="openHomeEntry(mainFeatureCard)">
              <view class="feature-card__copy">
                <text class="feature-card__title">{{ mainFeatureCard?.title }}</text>
                <text class="feature-card__subtitle">{{ mainFeatureCard?.subtitle }}</text>
              </view>
              <view class="feature-card__art feature-card__art--meal">
                <image
                  v-if="mainFeatureCard?.imageUrl"
                  class="feature-card__art-image"
                  :src="mainFeatureCard.imageUrl"
                  mode="aspectFill"
                />
                <view v-else class="feature-card__plate">
                  <view class="feature-card__food" />
                </view>
              </view>
            </view>

            <view class="feature-side">
              <view
                v-for="item in sideFeatureCards"
                :key="item.id"
                class="feature-card feature-card--side"
                :class="resolveSideCardClass(item.placement)"
                hover-class="feature-card--hover"
                hover-stay-time="100"
                @click="openHomeEntry(item)"
              >
                <text class="feature-card__title">{{ item.title }}</text>
                <text class="feature-card__subtitle">{{ item.subtitle }}</text>
                <view class="feature-card__mini feature-card__mini--members">
                  <image
                    v-if="item.imageUrl"
                    class="feature-card__mini-image"
                    :src="item.imageUrl"
                    mode="aspectFit"
                  />
                  <text v-else-if="item.badgeText" class="feature-card__mini-text">{{ item.badgeText }}</text>
                  <view v-else class="feature-card__mini-dot" />
                </view>
              </view>
            </view>
          </view>
          <view v-else-if="showFeatureEntriesSkeleton" class="feature-board">
            <view class="feature-card feature-card--main feature-card--skeleton">
              <view class="feature-card__copy feature-card__copy--skeleton">
                <Skeleton width="160rpx" height="30rpx" />
                <Skeleton width="220rpx" height="22rpx" />
              </view>
              <view class="feature-card__art feature-card__art--skeleton">
                <Skeleton width="100%" height="160rpx" radius="var(--radius-xs)" />
              </view>
            </view>
            <view class="feature-side">
              <view class="feature-card feature-card--side feature-card--mint feature-card--skeleton">
                <view class="feature-card__copy feature-card__copy--skeleton">
                  <Skeleton width="120rpx" height="30rpx" />
                  <Skeleton width="170rpx" height="22rpx" />
                </view>
                <view class="feature-card__mini feature-card__mini--skeleton">
                  <Skeleton width="100%" height="100%" radius="18rpx" />
                </view>
              </view>
              <view class="feature-card feature-card--side feature-card--green feature-card--skeleton">
                <view class="feature-card__copy feature-card__copy--skeleton">
                  <Skeleton width="120rpx" height="30rpx" />
                  <Skeleton width="170rpx" height="22rpx" />
                </view>
                <view class="feature-card__mini feature-card__mini--skeleton">
                  <Skeleton width="100%" height="100%" radius="18rpx" />
                </view>
              </view>
            </view>
          </view>

          <view v-if="hasQuickEntries" class="action-dock">
            <view
              v-for="item in quickEntryItems"
              :key="item.id"
              class="dock-action"
              hover-class="dock-action--hover"
              hover-stay-time="100"
              @click="openHomeEntry(item)"
            >
              <view class="dock-action__icon" :class="resolveQuickEntryClass(item.placement)">
                <image v-if="item.imageUrl" class="dock-action__image" :src="item.imageUrl" mode="aspectFit" />
                <text v-else-if="item.badgeText" class="dock-action__badge">{{ item.badgeText }}</text>
                <view v-else class="dock-action__dot" />
              </view>
              <text class="dock-action__title">{{ item.title }}</text>
            </view>
          </view>
          <view v-else-if="showQuickEntriesSkeleton" class="action-dock">
            <view v-for="placement in quickEntryPlacementList" :key="placement" class="dock-action dock-action--skeleton">
              <view class="dock-action__icon" :class="resolveQuickEntryClass(placement)">
                <Skeleton width="64rpx" height="64rpx" radius="20rpx" />
              </view>
              <Skeleton width="72rpx" height="24rpx" radius="var(--radius-pill)" />
            </view>
          </view>

          <view
            v-if="showRecentArrangementCard && recentArrangement"
            class="recent-arrangement"
            hover-class="recent-arrangement--hover"
            hover-stay-time="100"
            @click="openRecentArrangementDetail(recentArrangement)"
          >
            <view class="recent-arrangement__head">
              <view>
                <text class="recent-arrangement__eyebrow">最近安排</text>
                <text class="recent-arrangement__title">{{ recentArrangement.title }}</text>
              </view>
              <text class="recent-arrangement__badge">{{ resolveRecentArrangementSourceText(recentArrangement.sourceType) }}</text>
            </view>
            <text class="recent-arrangement__meta">{{ recentArrangementMeta }}</text>
            <text class="recent-arrangement__status">{{ recentArrangementStatusText }}</text>
            <view class="recent-arrangement__actions">
              <view class="recent-arrangement__button recent-arrangement__button--primary" @click.stop="openRecentArrangementPrimaryAction(recentArrangement)">
                <text class="recent-arrangement__button-text">{{ recentArrangementActionText }}</text>
              </view>
              <view class="recent-arrangement__button recent-arrangement__button--ghost" @click.stop="openRecentArrangementDetail(recentArrangement)">
                <text class="recent-arrangement__button-text recent-arrangement__button-text--ghost">查看详情</text>
              </view>
            </view>
          </view>
          <view v-else-if="showRecentArrangementSkeleton" class="recent-arrangement recent-arrangement--skeleton">
            <view class="recent-arrangement__head recent-arrangement__head--skeleton">
              <view class="recent-arrangement__copy">
                <Skeleton width="110rpx" height="24rpx" />
                <Skeleton width="260rpx" height="34rpx" />
              </view>
              <Skeleton width="80rpx" height="40rpx" radius="var(--radius-pill)" />
            </view>
            <view class="recent-arrangement__body-skeleton">
              <Skeleton width="100%" height="24rpx" />
              <Skeleton width="70%" height="24rpx" />
            </view>
            <view class="recent-arrangement__actions recent-arrangement__actions--skeleton">
              <Skeleton width="200rpx" height="76rpx" radius="var(--radius-pill)" />
              <Skeleton width="160rpx" height="76rpx" radius="var(--radius-pill)" />
            </view>
          </view>

          <view class="pantry-panel">
            <view class="pantry-panel__header">
              <view>
                <text class="pantry-panel__label">买菜和冰箱</text>
                <text class="pantry-panel__title">个人清单和冰箱</text>
              </view>
              <text class="pantry-panel__action" @click="navigateTo('/pages_pantry/list/index')">去买菜</text>
            </view>

            <view class="pantry-list">
              <Empty title="暂无买菜和冰箱数据" description="开始记录购物和食材后会显示在这里。" />
            </view>
          </view>

          <view class="table-section table-section--recipes">
            <view class="section-heading">
              <text class="section-heading__title">常吃清单</text>
              <text class="section-heading__action" @click="navigateTo('/pages/recipe/index')">菜谱</text>
            </view>
            <Empty title="暂无常吃菜谱" description="保存或复做菜谱后会显示在这里。" />
          </view>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { isUniRequestBlockedError } from "@/apis/adapters/uni";
import {
  homeApi,
  type HomeEntryItem,
  type HomeEntryPlacement,
  type HomeNextMealState,
  type HomeNextMealStatus,
  type HomeRecentArrangement,
  type HomeRecentArrangementStatus
} from "@/apis/home";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";

const pageStyle = usePageScrollStyle();

const HOME_NAV_GAP = 16;
const HOME_NAV_FADE_DISTANCE = 96;
const HIDDEN_HOME_TARGET_PREFIXES = ["/pages_restaurant/", "/pages_meal/poll/index", "/pages_meal/wish/index", "/pages_meal/result/index"];
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const userStore = useUserStore();
const homeScrollTop = ref(0);
const homeEntriesLoading = ref(false);
const homeEntriesLoaded = ref(false);
const homeEntriesRequestBlocked = ref(false);
const featureEntryItems = ref<HomeEntryItem[]>([]);
const quickEntryItems = ref<HomeEntryItem[]>([]);
const nextMealStateLoading = ref(false);
const nextMealStateLoaded = ref(false);
const nextMealState = ref<HomeNextMealState | null>(null);
let homeEntriesLoadPromise: Promise<void> | null = null;
let nextMealStateLoadPromise: Promise<void> | null = null;

const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + HOME_NAV_GAP}px`,
  backgroundImage: userStore.profile?.display?.homeBackgroundUrl ? `url(${userStore.profile.display.homeBackgroundUrl})` : undefined,
  backgroundSize: userStore.profile?.display?.homeBackgroundUrl ? "cover" : undefined,
  backgroundPosition: userStore.profile?.display?.homeBackgroundUrl ? "center" : undefined
}));
const navProgress = computed(() => Math.min(1, Math.max(0, homeScrollTop.value / HOME_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));

const restaurantName = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后开始安排";
  return "饭局、计划、清单";
});
const mainFeatureCard = computed(() => featureEntryItems.value.find(item => item.placement === "MAIN") ?? null);
const sideFeatureCards = computed(() =>
  featureEntryItems.value
    .filter(item => item.placement === "SIDE_TOP" || item.placement === "SIDE_BOTTOM")
    .sort((left, right) => (left.placement === "SIDE_TOP" ? 0 : 1) - (right.placement === "SIDE_TOP" ? 0 : 1))
);
const quickEntryPlacementList: HomeEntryPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const hasFeatureEntries = computed(() => Boolean(mainFeatureCard.value) && sideFeatureCards.value.length === 2);
const hasQuickEntries = computed(() => quickEntryItems.value.length > 0);
const showFeatureEntriesSkeleton = computed(() => !hasFeatureEntries.value && (homeEntriesLoading.value || !homeEntriesLoaded.value));
const showQuickEntriesSkeleton = computed(() => !hasQuickEntries.value && (homeEntriesLoading.value || !homeEntriesLoaded.value));
const homeNextStatus = computed<HomeNextMealStatus>(() => nextMealState.value?.status ?? "NO_ARRANGEMENT");
const recentArrangement = computed(() => nextMealState.value?.arrangement ?? null);
const showRecentArrangementCard = computed(() => homeNextStatus.value === "COMPLETED" && Boolean(recentArrangement.value));
const showRecentArrangementSkeleton = computed(
  () => sessionStore.isLoggedIn && nextMealStateLoading.value && !nextMealStateLoaded.value
);
const recentArrangementMeta = computed(() => {
  if (!recentArrangement.value) return "";
  const segments = [
    formatRecentArrangementTime(recentArrangement.value),
    `${recentArrangement.value.participantCount}人`,
    `${recentArrangement.value.menuCount}道菜`
  ];
  if (typeof recentArrangement.value.gapCount === "number" && recentArrangement.value.gapCount > 0) {
    segments.push(`还差${recentArrangement.value.gapCount}样食材`);
  }
  return segments.join(" · ");
});
const recentArrangementStatusText = computed(() => (recentArrangement.value ? resolveRecentArrangementStatusText(recentArrangement.value.status) : ""));
const recentArrangementActionText = computed(() => (recentArrangement.value ? resolveRecentArrangementActionText(recentArrangement.value.status) : ""));
const heroEyebrow = computed(() => {
  if (!sessionStore.isLoggedIn) return "下一顿状态";
  if (nextMealStateLoading.value && !nextMealStateLoaded.value) return "正在整理安排";
  if (homeNextStatus.value === "NO_ARRANGEMENT") return "还没有安排";
  if (homeNextStatus.value === "COMPLETED") return "上一顿刚刚结束";
  return recentArrangement.value ? formatRecentArrangementMetaLead(recentArrangement.value) : "下一步继续";
});

const heroTitle = computed(() => {
  return "今晚吃什么？";
});
const heroDescription = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后把下一顿、购物清单和冰箱状态接起来。";
  if (nextMealStateLoading.value && !nextMealStateLoaded.value) return "正在按你的安排、缺口和采购状态整理下一步。";
  if (homeNextStatus.value === "NO_ARRANGEMENT") return "还没有安排，试试随机一桌，或者先看看冰箱里现在能做什么。";
  if (homeNextStatus.value === "NEED_GAP_CHECK") {
    if (!recentArrangement.value) return "先把这顿饭安排起来，再看缺什么。";
    if (recentArrangement.value.menuCount > 0) return `${recentArrangementMeta.value}，先把菜单和缺口过一遍。`;
    return `${formatRecentArrangementTime(recentArrangement.value)}，先把这顿要吃什么定下来。`;
  }
  if (homeNextStatus.value === "NEED_SHOPPING") {
    if (!recentArrangement.value) return "还差一些食材，先去采购。";
    return `${recentArrangementMeta.value}，先把缺的食材补齐。`;
  }
  if (homeNextStatus.value === "READY_TO_COOK") {
    if (!recentArrangement.value) return "食材差不多齐了，可以开始做饭。";
    return `${recentArrangementMeta.value}，这顿饭可以开始做了。`;
  }
  return recentArrangement.value ? `${recentArrangementMeta.value}，回看一下这顿饭，再决定下一顿。` : "上一顿已经结束，接下来继续安排新的一顿。";
});
const heroPrimaryActionText = computed(() => {
  if (!sessionStore.isLoggedIn) return "随机一桌";
  if (homeNextStatus.value === "NO_ARRANGEMENT") return "随机一桌";
  if (homeNextStatus.value === "NEED_GAP_CHECK") return recentArrangement.value?.menuCount ? "看看缺什么" : "去加菜";
  if (homeNextStatus.value === "NEED_SHOPPING") return "去采购";
  if (homeNextStatus.value === "READY_TO_COOK") return "开始做饭";
  return "分享回忆";
});
const heroSecondaryActionText = computed(() => {
  if (!sessionStore.isLoggedIn) return "看冰箱";
  if (homeNextStatus.value === "NO_ARRANGEMENT") return "看冰箱";
  if (homeNextStatus.value === "COMPLETED") return "看冰箱";
  return "查看详情";
});

onShow(() => {
  void Promise.all([loadHomeEntries(), loadNextMealState(true)]);
});

async function loadHomeEntries(force = false) {
  if (homeEntriesLoadPromise) {
    await homeEntriesLoadPromise;
    return;
  }

  if (!force && homeEntriesLoaded.value) return;

  homeEntriesLoading.value = true;
  if (force) {
    homeEntriesRequestBlocked.value = false;
  }

  homeEntriesLoadPromise = homeApi
    .getHomeEntries()
    .then(result => {
      const visibleItems = result.items.filter(item => isVisibleHomeEntry(item.targetValue));
      featureEntryItems.value = visibleItems.filter(
        item => item.placement === "MAIN" || item.placement === "SIDE_TOP" || item.placement === "SIDE_BOTTOM"
      );
      quickEntryItems.value = visibleItems.filter(
        item => item.placement === "QUICK_1" || item.placement === "QUICK_2" || item.placement === "QUICK_3" || item.placement === "QUICK_4"
      );
      homeEntriesLoaded.value = true;
      homeEntriesRequestBlocked.value = false;
    })
    .catch(async error => {
      if (!hasFeatureEntries.value) {
        featureEntryItems.value = [];
      }
      if (!hasQuickEntries.value) {
        quickEntryItems.value = [];
      }
      homeEntriesLoaded.value = hasFeatureEntries.value || hasQuickEntries.value;
      homeEntriesRequestBlocked.value = isUniRequestBlockedError(error);
      await showLoadToast(error instanceof Error ? error.message : "首页快捷入口加载失败");
    })
    .finally(() => {
      homeEntriesLoading.value = false;
      homeEntriesLoadPromise = null;
    });

  await homeEntriesLoadPromise;
}

async function loadNextMealState(force = false) {
  if (!sessionStore.isLoggedIn) {
    nextMealState.value = null;
    nextMealStateLoading.value = false;
    nextMealStateLoaded.value = false;
    return;
  }

  if (nextMealStateLoadPromise) {
    await nextMealStateLoadPromise;
    return;
  }

  if (!force && nextMealStateLoaded.value) return;

  nextMealStateLoading.value = true;
  nextMealStateLoadPromise = homeApi
    .getNextMealState()
    .then(result => {
      nextMealState.value = result;
      nextMealStateLoaded.value = true;
    })
    .catch(() => {
      nextMealState.value = {
        status: "NO_ARRANGEMENT",
        arrangement: null
      };
      nextMealStateLoaded.value = true;
    })
    .finally(() => {
      nextMealStateLoading.value = false;
      nextMealStateLoadPromise = null;
    });

  await nextMealStateLoadPromise;
}

async function showLoadToast(title: string) {
  await uniPlatform.feedback.toast({
    title,
    icon: "none"
  }).catch(() => undefined);
}

function resolveSideCardClass(placement: HomeEntryItem["placement"]) {
  return placement === "SIDE_TOP" ? "feature-card--mint" : "feature-card--green";
}

function resolveQuickEntryClass(placement: HomeEntryPlacement) {
  if (placement === "QUICK_1") return "quick-action--primary";
  if (placement === "QUICK_2") return "quick-action--mint";
  if (placement === "QUICK_3") return "quick-action--aqua";
  return "quick-action--soft";
}

function isVisibleHomeEntry(targetValue: string) {
  return !HIDDEN_HOME_TARGET_PREFIXES.some(prefix => targetValue.startsWith(prefix));
}

function openHomeEntry(item: HomeEntryItem | null) {
  if (!item) return;

  if (item.targetType === "WEB_VIEW") {
    if (!/^https:\/\//iu.test(item.targetValue)) return;
    navigateTo(`/pages_web/content/index?url=${encodeURIComponent(item.targetValue)}`);
    return;
  }

  navigateTo(item.targetValue);
}

function triggerHeroPrimaryAction() {
  if (!sessionStore.isLoggedIn || homeNextStatus.value === "NO_ARRANGEMENT") {
    navigateTo("/pages_meal/random/index");
    return;
  }
  if (!recentArrangement.value) {
    navigateTo("/pages_pantry/index/index");
    return;
  }
  if (homeNextStatus.value === "NEED_GAP_CHECK") {
    navigateTo(buildRecentArrangementDetailUrl(recentArrangement.value, recentArrangement.value.menuCount > 0 ? "shopping" : "menu"));
    return;
  }
  if (homeNextStatus.value === "NEED_SHOPPING") {
    navigateTo(buildRecentArrangementDetailUrl(recentArrangement.value, "shopping"));
    return;
  }
  if (homeNextStatus.value === "READY_TO_COOK") {
    navigateTo(buildRecentArrangementDetailUrl(recentArrangement.value, "assistant"));
    return;
  }
  navigateTo(buildRecentArrangementDetailUrl(recentArrangement.value, "memory"));
}

function triggerHeroSecondaryAction() {
  if (!sessionStore.isLoggedIn || homeNextStatus.value === "NO_ARRANGEMENT" || homeNextStatus.value === "COMPLETED") {
    navigateTo("/pages_pantry/index/index");
    return;
  }
  if (recentArrangement.value) {
    openRecentArrangementDetail(recentArrangement.value);
  }
}

function openRecentArrangementPrimaryAction(item: HomeRecentArrangement) {
  navigateTo(buildRecentArrangementDetailUrl(item, resolveRecentArrangementFocus(item.status)));
}

function openRecentArrangementDetail(item: HomeRecentArrangement) {
  navigateTo(buildRecentArrangementDetailUrl(item));
}

function handleHomeScroll(event: { detail?: { scrollTop?: number } }) {
  homeScrollTop.value = event.detail?.scrollTop ?? 0;
}

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
}

function resolveRecentArrangementSourceText(sourceType: HomeRecentArrangement["sourceType"]) {
  return sourceType === "EVENT" ? "饭局" : "计划";
}

function formatRecentArrangementMetaLead(item: HomeRecentArrangement) {
  return `${formatRecentArrangementTime(item)} · ${item.participantCount}人`;
}

function resolveRecentArrangementStatusText(status: HomeRecentArrangementStatus) {
  if (status === "EMPTY_MENU") return "还没定菜单";
  if (status === "PENDING_CONFIRM") return "待确认菜单";
  if (status === "PENDING_SHOPPING") return "待采购";
  if (status === "READY_TO_COOK") return "可以开始做饭";
  return "该分享回忆了";
}

function resolveRecentArrangementActionText(status: HomeRecentArrangementStatus) {
  if (status === "EMPTY_MENU") return "去加菜";
  if (status === "PENDING_CONFIRM") return "确认菜单";
  if (status === "PENDING_SHOPPING") return "去采购";
  if (status === "READY_TO_COOK") return "开始做饭";
  return "分享回忆";
}

function resolveRecentArrangementFocus(status: HomeRecentArrangementStatus) {
  if (status === "EMPTY_MENU") return "menu";
  if (status === "PENDING_CONFIRM") return "footer";
  if (status === "PENDING_SHOPPING") return "shopping";
  if (status === "READY_TO_COOK") return "assistant";
  return "memory";
}

function buildRecentArrangementDetailUrl(item: HomeRecentArrangement, focus?: "menu" | "footer" | "shopping" | "assistant" | "memory") {
  const query = [
    `planItemId=${encodeURIComponent(String(item.planItemId))}`,
    `planDate=${encodeURIComponent(item.planDate)}`
  ];
  if (item.eventId) {
    query.push(`eventId=${encodeURIComponent(String(item.eventId))}`);
  }
  if (focus) {
    query.push(`focus=${encodeURIComponent(focus)}`);
  }
  return `/pages_meal/detail/index?${query.join("&")}`;
}

function formatRecentArrangementTime(item: HomeRecentArrangement) {
  if (item.scheduledAt) {
    const date = new Date(item.scheduledAt);
    if (Number.isFinite(date.getTime())) {
      const now = new Date();
      const dayDiff = resolveDayDiff(date, now);
      const timeText = `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
      if (dayDiff === 0) return `今天 ${timeText}`;
      if (dayDiff === 1) return `明天 ${timeText}`;
      if (dayDiff === -1) return `昨天 ${timeText}`;
      return `${date.getMonth() + 1}月${date.getDate()}日 ${timeText}`;
    }
  }
  return item.planDate;
}

function resolveDayDiff(target: Date, base: Date) {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.round((targetDay - baseDay) / 86400000);
}
</script>

<style scoped lang="scss">
.home-nav-backdrop {
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

.table-scroll {
  height: 100%;
  background: var(--color-page);
}

.table-page {
  min-height: 100%;
  padding-bottom: var(--space-page);
}

.table-hero {
  position: relative;
  overflow: hidden;
  min-height: 560rpx;
  padding: 64rpx var(--space-page) 200rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, var(--entry-side-mint-bg) 0, transparent 30%),
    radial-gradient(circle at 84% 18%, var(--entry-side-aqua-bg) 0, transparent 28%),
    linear-gradient(145deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.table-hero::before {
  position: absolute;
  right: -42%;
  bottom: -2rpx;
  left: -42%;
  z-index: 3;
  height: 300rpx;
  background:
    radial-gradient(
      100% 120% at 50% -30%,
      transparent 46%,
      var(--color-surface-mask-weak) 53%,
      var(--color-surface-mask-medium) 62%,
      var(--color-surface-mask-strong) 75%,
      var(--color-surface) 90%
    );
  content: "";
  pointer-events: none;
}

.table-hero::after {
  position: absolute;
  right: -144rpx;
  bottom: -138rpx;
  width: 390rpx;
  height: 390rpx;
  border-radius: 50%;
  background: var(--color-surface-mask-medium);
  content: "";
}

.table-nav__selector {
  min-width: 0;
}

.table-nav__selector--hover,
.decision-card--hover,
.feature-card--hover,
.dock-action--hover,
.family-recipe--hover {
  opacity: 0.86;
}

.restaurant-bar__label,
.restaurant-bar__name,
.hero-copy__eyebrow,
.hero-copy__title,
.hero-copy__description {
  display: block;
}

.restaurant-bar__label {
  color: var(--entry-muted-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.restaurant-bar__name {
  overflow: hidden;
  max-width: 420rpx;
  margin-top: 8rpx;
  color: var(--entry-ink);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-main {
  position: relative;
  z-index: 2;
  min-height: 330rpx;
  margin-top: 30rpx;
}

.hero-copy {
  position: relative;
  z-index: 2;
  width: 420rpx;
}

.hero-copy__eyebrow {
  color: var(--entry-ink);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero-copy__title {
  margin-top: 18rpx;
  color: var(--entry-ink);
  font-size: 58rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.04;
}

.hero-copy__description {
  margin-top: 20rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.hero-copy__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}

.hero-copy__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 78rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
}

.hero-copy__button--primary {
  background: var(--entry-ink);
  box-shadow: var(--shadow-card);
}

.hero-copy__button--ghost {
  border: 1rpx solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 90%, white 10%);
}

.hero-copy__button-text {
  color: var(--color-white);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.hero-copy__button-text--ghost {
  color: var(--color-text);
}

.table-scene {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.table-scene__cloth {
  position: absolute;
  right: -60rpx;
  bottom: -2rpx;
  width: 536rpx;
  height: 266rpx;
  border-radius: 92rpx 72rpx 0 0;
  background: var(--color-surface-mask-medium);
  box-shadow: inset 0 0 0 1rpx var(--color-surface-mask-strong);
  transform: rotate(-4deg);
}

.table-scene__plate {
  position: absolute;
  right: 80rpx;
  bottom: 82rpx;
  width: 206rpx;
  height: 138rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  box-shadow: var(--entry-board-shadow);
  transform: rotate(-8deg);
}

.table-scene__rice {
  position: absolute;
  top: 34rpx;
  left: 66rpx;
  width: 78rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -38rpx 12rpx 0 var(--entry-food-orange),
    42rpx 10rpx 0 var(--entry-food-green),
    4rpx 44rpx 0 var(--entry-food-yellow);
}

.table-scene__leaf {
  position: absolute;
  width: 68rpx;
  height: 30rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-leaf-left);
}

.table-scene__leaf--left {
  top: -12rpx;
  left: 22rpx;
  transform: rotate(-28deg);
}

.table-scene__leaf--right {
  right: 18rpx;
  bottom: 10rpx;
  background: var(--entry-leaf-right);
  transform: rotate(-20deg);
}

.table-scene__egg {
  position: absolute;
  top: 50rpx;
  right: 48rpx;
  width: 46rpx;
  height: 46rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-egg-bg);
}

.table-scene__bowl {
  position: absolute;
  right: 306rpx;
  bottom: 54rpx;
  width: 128rpx;
  height: 88rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 28rpx 28rpx 68rpx 68rpx;
  background: var(--entry-side-aqua-bg);
  box-shadow: var(--entry-board-shadow);
  transform: rotate(7deg);
}

.table-scene__cup {
  position: absolute;
  right: 40rpx;
  bottom: 56rpx;
  width: 66rpx;
  height: 78rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 18rpx 18rpx 28rpx 28rpx;
  background: var(--entry-side-mint-bg);
  transform: rotate(-10deg);
}

.table-content {
  position: relative;
  z-index: 3;
  margin-top: -200rpx;
  padding: 50rpx var(--space-page) 28rpx;
}

.feature-board {
  display: flex;
  gap: 20rpx;
}

.feature-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xs);
}

.feature-card--main {
  flex: 1 1 0;
  padding: 20rpx;
  background: var(--entry-primary-bg);
}

.feature-side {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 20rpx;
}

.feature-card--side {
  flex: 1;
  min-height: 140rpx;
  padding: 20rpx;
}

.feature-card--mint {
  background: var(--entry-side-mint-bg);
}

.feature-card--green {
  background: var(--entry-side-aqua-bg);
}

.feature-card__title,
.feature-card__subtitle {
  position: relative;
  z-index: 2;
  display: block;
}

.feature-card__title {
  color: var(--entry-ink);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.feature-card__subtitle {
  margin-top: 10rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.feature-card__art {
  position: absolute;
  right: 20rpx;
  bottom: 20rpx;
  left: 20rpx;
  height: 160rpx;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--entry-photo-bg);
  box-shadow: var(--entry-photo-shadow);
}

.feature-card__art-image,
.feature-card__mini-image {
  width: 100%;
  height: 100%;
}

.feature-card__plate {
  position: absolute;
  top: 30rpx;
  left: 50%;
  width: 132rpx;
  height: 88rpx;
  border: 5rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: translateX(-50%) rotate(-6deg);
}

.feature-card__food {
  position: absolute;
  top: 22rpx;
  left: 42rpx;
  width: 48rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -24rpx 8rpx 0 var(--entry-food-orange),
    26rpx 7rpx 0 var(--entry-food-green),
    3rpx 28rpx 0 var(--entry-food-yellow);
}

.feature-card__mini {
  position: absolute;
  right: 10rpx;
  bottom: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  transform: rotate(-7deg);
}


.feature-card--skeleton {
  pointer-events: none;
}

.feature-card__copy--skeleton {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
}

.feature-card__art--skeleton {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.feature-card__mini--skeleton {
  padding: 0;
  border: 0;
  background: transparent;
}

.feature-card__mini-text {
  color: var(--entry-ink);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
}

.feature-card__mini-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-food-yellow);
  box-shadow: 12rpx -12rpx 0 -3rpx var(--entry-accent);
}

.action-dock {
  display: flex;
  justify-content: space-evenly;
  margin-top: 32rpx;
}

.recent-arrangement {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: var(--radius-card);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--entry-side-mint-bg) 70%, transparent) 0, transparent 34%),
    linear-gradient(135deg, color-mix(in srgb, var(--entry-board-bg) 90%, white 10%), var(--color-surface));
  box-shadow: var(--shadow-card);
}

.recent-arrangement--hover {
  opacity: 0.88;
}

.recent-arrangement--skeleton {
  pointer-events: none;
}

.recent-arrangement__head,
.recent-arrangement__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-arrangement__head {
  gap: 18rpx;
}

.recent-arrangement__head--skeleton {
  align-items: flex-start;
}

.recent-arrangement__copy {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.recent-arrangement__eyebrow,
.recent-arrangement__title,
.recent-arrangement__meta,
.recent-arrangement__status {
  display: block;
}

.recent-arrangement__eyebrow {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.recent-arrangement__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.24;
}

.recent-arrangement__badge {
  flex: 0 0 auto;
  padding: 12rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-primary-bg);
  color: var(--entry-ink);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.recent-arrangement__meta {
  margin-top: 18rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.recent-arrangement__status {
  margin-top: 12rpx;
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.recent-arrangement__actions {
  gap: 18rpx;
  margin-top: 24rpx;
}

.recent-arrangement__actions--skeleton {
  justify-content: flex-start;
}

.recent-arrangement__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 28rpx;
  height: 76rpx;
  border-radius: var(--radius-pill);
}

.recent-arrangement__button--primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-active));
  box-shadow: var(--shadow-card);
}

.recent-arrangement__button--ghost {
  border: 1rpx solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 90%, white 10%);
}

.recent-arrangement__button-text {
  color: var(--color-white);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.recent-arrangement__button-text--ghost {
  color: var(--color-text);
}

.recent-arrangement__body-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.dock-action {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
}

.dock-action--skeleton {
  pointer-events: none;
}

.dock-action__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  box-shadow: var(--shadow-card);
}

.dock-action__icon.quick-action--primary {
  background: var(--entry-primary-bg);
}

.dock-action__icon.quick-action--mint {
  background: var(--entry-side-mint-bg);
}

.dock-action__icon.quick-action--aqua {
  background: var(--entry-side-aqua-bg);
}

.dock-action__icon.quick-action--soft {
  background: var(--color-surface-muted);
}

.dock-action__image {
  width: 100%;
  height: 100%;
}

.dock-action__badge {
  color: var(--entry-ink);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.dock-action__dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-food-yellow);
  box-shadow: 10rpx -10rpx 0 -3rpx var(--entry-accent);
}

.dock-action__title {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-align: center;
}

.decision-card,
.table-section,
.pantry-panel {
  box-shadow: var(--shadow-card);
}

.decision-card {
  overflow: hidden;
  padding: 30rpx;
  border-radius: var(--entry-board-radius);
  background: var(--entry-board-bg);
}

.decision-card__header,
.decision-card__footer,
.decision-progress,
.pantry-panel__header,
.pantry-item {
  display: flex;
}

.decision-card__header {
  align-items: flex-start;
  justify-content: space-between;
}

.decision-card__label,
.decision-card__title,
.decision-card__hint,
.decision-card__action {
  display: block;
}

.decision-card__label {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.decision-card__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.decision-card__badge {
  flex: 0 0 auto;
  padding: 12rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
}

.decision-card__badge-text {
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 28rpx;
}

.candidate-item {
  display: flex;
  align-items: center;
  min-height: 86rpx;
  padding: 14rpx 16rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.candidate-item__rank {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
}

.candidate-item__rank-text {
  color: var(--entry-button-color);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.candidate-item__main {
  min-width: 0;
  margin-left: 16rpx;
}

.candidate-item__name,
.candidate-item__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-item__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.candidate-item__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.candidate-item__votes {
  flex: 0 0 auto;
  margin-left: 14rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.decision-progress {
  align-items: center;
  margin-top: 24rpx;
}

.decision-progress__track {
  overflow: hidden;
  flex: 1;
  height: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.decision-progress__value {
  width: 50%;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

.decision-progress__text {
  flex: 0 0 auto;
  margin-left: 16rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.decision-card__footer {
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid var(--color-divider);
}

.decision-card__hint {
  min-width: 0;
  padding-right: 20rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.decision-card__action {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.table-section,
.pantry-panel {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.section-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.section-heading__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.family-feed {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.feed-item {
  display: flex;
  align-items: center;
}

.feed-item__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: var(--radius-pill);
}

.feed-item__avatar--rose {
  background: var(--entry-primary-bg);
}

.feed-item__avatar--green {
  background: var(--entry-side-mint-bg);
}

.feed-item__avatar--blue {
  background: var(--entry-side-aqua-bg);
}

.feed-item__avatar-text {
  color: var(--entry-ink);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.feed-item__content {
  min-width: 0;
  margin-left: 18rpx;
}

.feed-item__title,
.feed-item__description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.feed-item__description {
  max-width: 430rpx;
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.feed-item__time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.pantry-panel {
  background: linear-gradient(135deg, var(--entry-side-aqua-bg), var(--color-surface));
}

.pantry-panel__header {
  align-items: flex-start;
  justify-content: space-between;
}

.pantry-panel__label,
.pantry-panel__title,
.pantry-panel__action {
  display: block;
}

.pantry-panel__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.pantry-panel__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.pantry-panel__action {
  flex: 0 0 auto;
  padding: 14rpx 22rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
  color: var(--entry-button-color);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.pantry-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.pantry-item {
  align-items: center;
  min-height: 72rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-md);
  background: var(--entry-photo-bg);
}

.pantry-item__dot {
  flex: 0 0 auto;
  width: 16rpx;
  height: 16rpx;
  border-radius: var(--radius-pill);
}

.pantry-item__dot--danger {
  background: var(--entry-food-orange);
}

.pantry-item__dot--warning {
  background: var(--entry-food-yellow);
}

.pantry-item__dot--ok {
  background: var(--entry-food-green);
}

.pantry-item__name {
  min-width: 0;
  margin-left: 16rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.pantry-item__state {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.table-section--recipes {
  padding-right: 0;
}

.recipe-scroll {
  width: 100%;
  white-space: nowrap;
}

.family-recipe {
  display: inline-block;
  width: 204rpx;
  margin-right: 18rpx;
  vertical-align: top;
}

.family-recipe__visual {
  position: relative;
  overflow: hidden;
  height: 220rpx;
  border-radius: var(--radius-card);
  background: var(--entry-board-bg);
}

.family-recipe__visual--warm {
  background: linear-gradient(145deg, var(--entry-primary-bg), var(--entry-photo-plate-bg));
}

.family-recipe__visual--fresh {
  background: linear-gradient(145deg, var(--entry-side-mint-bg), var(--entry-board-bg));
}

.family-recipe__visual--cool {
  background: linear-gradient(145deg, var(--entry-side-aqua-bg), var(--entry-board-bg));
}

.family-recipe__plate {
  position: absolute;
  right: 24rpx;
  bottom: 50rpx;
  width: 148rpx;
  height: 104rpx;
  border: 6rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: rotate(-8deg);
}

.family-recipe__food {
  position: absolute;
  top: 28rpx;
  left: 50rpx;
  width: 48rpx;
  height: 38rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -28rpx 8rpx 0 var(--entry-food-orange),
    30rpx 8rpx 0 var(--entry-food-green),
    2rpx 30rpx 0 var(--entry-food-yellow);
}

.family-recipe__name,
.family-recipe__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.family-recipe__name {
  margin-top: 14rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.family-recipe__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
