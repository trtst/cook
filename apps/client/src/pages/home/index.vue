<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses"
    title=""
    current-tab="home"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
  >
    <template #navbar-center>
      <view class="table-nav__selector">
        <text class="restaurant-bar__label">{{ navGreeting.subtitle }}</text>
        <text class="restaurant-bar__name">{{ navGreeting.title }}</text>
      </view>
    </template>
    <view class="home-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="table-scroll" scroll-y :show-scrollbar="false" @scroll="handleHomeScroll">
      <view class="table-page">
        <view class="theme-probe" aria-hidden="true">
          <view class="theme-probe__input" />
          <view class="theme-probe__control" />
        </view>
        <view class="table-hero" :style="heroStyle">
          <swiper
            class="hero-swiper"
            circular
            :autoplay="false"
            :interval="0"
            :duration="280"
            :current="heroSwiperCurrent"
            @change="handleHeroSwiperChange"
          >
            <swiper-item v-for="item in heroSlides" :key="item.key" class="hero-swiper__item">
              <view class="hero-banner" hover-class="hero-banner--hover" hover-stay-time="100" @click="openHomeEntry(item.entry)">
                <image class="hero-banner__image" :src="item.imageUrl" mode="aspectFill" />
                <view class="hero-banner__shade" />
                <view class="hero-banner__copy">
                  <text class="hero-banner__eyebrow">{{ item.eyebrow }}</text>
                  <text class="hero-banner__title">{{ item.title }}</text>
                  <text class="hero-banner__description">{{ item.description }}</text>
                  <view v-if="item.entry" class="hero-banner__action">
                    <text class="hero-banner__action-text">{{ item.actionText }}</text>
                  </view>
                </view>
              </view>
            </swiper-item>
          </swiper>
        </view>

        <view class="table-content">
          <view v-if="hasFeatureEntries" class="feature-board">
            <view class="feature-card feature-card--main feature-card--status" hover-class="feature-card--hover" hover-stay-time="100" @click="openWeekOverview">
              <view class="feature-card__copy feature-card__copy--status">
                <view class="feature-card__status-body">
                  <view class="feature-card__title-row">
                    <text class="cookfont feature-card__weekmark-icon" :class="currentWeekIconClass" aria-hidden="true" />
                    <text class="feature-card__title">{{ weekOverviewState?.title || "这周吃饭安排" }}</text>
                  </view>
                  <text class="feature-card__subtitle">{{ weekOverviewSummary }}</text>
                </view>
                <view class="feature-card__status-action">
                  <text class="feature-card__status-action-text">{{ weekOverviewActionText }}</text>
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
                <Skeleton width="200rpx" height="22rpx" />
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
              @click="openQuickEntry(item)"
            >
              <view class="dock-action__icon" :class="resolveQuickEntryClass(item.placement)">
                <image v-if="item.imageUrl" class="dock-action__image" :src="item.imageUrl" mode="aspectFit" />
                <text v-else-if="item.badgeText" class="dock-action__badge">{{ item.badgeText }}</text>
                <view v-else class="dock-action__dot" />
              </view>
              <text class="dock-action__title">{{ resolveQuickEntryTitle(item) }}</text>
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
            <view class="recent-arrangement__stack" aria-hidden="true">
              <view class="recent-arrangement__back recent-arrangement__back--near" />
              <view class="recent-arrangement__back recent-arrangement__back--far" />
            </view>
            <view class="recent-arrangement__panel">
              <view class="recent-arrangement__head">
                <view>
                  <text class="recent-arrangement__eyebrow">最近安排</text>
                  <text class="recent-arrangement__title">{{ recentArrangement.title }}</text>
                </view>
                <text class="recent-arrangement__status recent-arrangement__status--head">{{ recentArrangementStatusText }}</text>
              </view>
              <text class="recent-arrangement__meta">{{ recentArrangementMeta }}</text>
              <text class="recent-arrangement__hint">{{ recentArrangementHintText }}</text>
              <view class="recent-arrangement__actions">
                <view class="recent-arrangement__button" @click.stop="openRecentArrangementPrimaryAction(recentArrangement)">
                  <text class="recent-arrangement__button-text">{{ recentArrangementActionText(recentArrangement.status) }}</text>
                </view>
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

          <view class="table-section table-section--recipes">
            <view class="section-heading">
              <view class="section-heading__copy">
                <text class="section-heading__eyebrow">按冰箱食材</text>
                <text class="section-heading__title">先看看能做的菜</text>
              </view>
              <text class="section-heading__action" @click="refreshFridgeRecipeRecommendations">换一换</text>
            </view>
            <scroll-view v-if="visibleFridgeRecipes.length" scroll-x class="recipe-scroll" show-scrollbar="false">
              <view
                v-for="item in visibleFridgeRecipes"
                :key="`${item.kind}-${item.recipeId}`"
                class="family-recipe"
                hover-class="family-recipe--hover"
                hover-stay-time="100"
                @click="openFridgeRecipe(item)"
              >
                <view class="family-recipe__visual">
                  <image v-if="item.coverImageUrl" class="family-recipe__image" :src="item.coverImageUrl" mode="aspectFill" />
                  <view v-else class="family-recipe__visual family-recipe__visual--warm">
                    <view class="family-recipe__plate">
                      <view class="family-recipe__food" />
                    </view>
                  </view>
                  <view class="family-recipe__badges">
                    <text class="family-recipe__badge">{{ fridgeFitText(item.fridgeFit) }}</text>
                    <text class="family-recipe__badge family-recipe__badge--soft">{{ item.kind === "MY" ? "私房菜" : "灵感" }}</text>
                  </view>
                </view>
                <text class="family-recipe__name">{{ item.title }}</text>
                <text class="family-recipe__meta">{{ fridgeRecipeMeta(item) }}</text>
              </view>
            </scroll-view>
            <view v-else-if="showFridgeRecipesSkeleton" class="recipe-scroll">
              <view v-for="index in 3" :key="index" class="family-recipe family-recipe--skeleton">
                <Skeleton width="204rpx" height="220rpx" radius="var(--radius-card)" />
                <view class="family-recipe__skeleton-copy">
                  <Skeleton width="160rpx" height="24rpx" />
                  <Skeleton width="120rpx" height="20rpx" />
                </view>
              </view>
            </view>
            <view v-else class="fridge-empty">
              <Empty
                :title="fridgeRecipesEmptyTitle"
                :description="fridgeRecipesEmptyDescription"
                :clickable="!sessionStore.isLoggedIn"
                @click="openLogin()"
              />
              <view v-if="sessionStore.isLoggedIn" class="fridge-empty__actions">
                <view class="fridge-empty__button fridge-empty__button--primary" @click="openFridgeEmptyPrimaryAction">
                  <text>{{ fridgeRecipesEmptyPrimaryActionText }}</text>
                </view>
                <view class="fridge-empty__button fridge-empty__button--secondary" @click="openRandomEntry">
                  <text>随机一桌</text>
                </view>
              </view>
            </view>
          </view>

          <view class="pantry-panel">
            <view class="pantry-panel__header">
              <view>
                <text class="pantry-panel__label">采购和库存都在这里</text>
                <text class="pantry-panel__title">清单和冰箱</text>
              </view>
              <text class="pantry-panel__action" @click="navigateTo('/pages_pantry/list/index')">去补清单</text>
            </view>

            <view class="pantry-list">
              <view v-if="showPantrySummarySkeleton" class="pantry-summary">
                <view class="pantry-summary__stats">
                  <view v-for="index in 3" :key="index" class="pantry-summary__stat">
                    <Skeleton width="68rpx" height="34rpx" radius="18rpx" />
                    <Skeleton width="112rpx" height="22rpx" radius="12rpx" />
                  </view>
                </view>
                <Skeleton width="320rpx" height="24rpx" radius="12rpx" />
              </view>
              <view v-else-if="hasPantrySummaryData" class="pantry-summary">
                <view class="pantry-summary__stats">
                  <view v-for="item in pantrySummaryItems" :key="item.label" class="pantry-summary__stat">
                    <text class="pantry-summary__value">{{ item.value }}</text>
                    <text class="pantry-summary__label">{{ item.label }}</text>
                  </view>
                </view>
                <text class="pantry-summary__hint">{{ pantrySummaryHintText }}</text>
              </view>
              <Empty v-else title="还没有记录购物和食材" description="先记食材，或者先建一张清单。" />
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { isUniRequestBlockedError } from "@/apis/adapters/uni";
import {
  homeApi,
  type HomeEntryItem,
  type HomeEntryPlacement,
  type HomeFridgeRecipeItem,
  type HomeNextMealState,
  type HomeNextMealStatus,
  type HomeRecentArrangement,
  type HomeWeekOverview,
  type HomeWeekOverviewStatus
} from "@/apis/home";
import { fridgeApi } from "@/apis/fridge";
import { shoppingApi } from "@/apis/shopping";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { cfg } from "@/config";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useAppConfigStore } from "@/stores/app-config";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore } from "@/stores/settings";
import { formatThemeText, type ThemeMode, type ThemePalette, type ThemeSkin } from "@/themes";
import {
  buildRecentArrangementDetailUrl,
  resolveRecentArrangementFocus
} from "@/utils/recent-arrangement-focus";
import {
  recentArrangementActionText,
  recentArrangementCopyPicker
} from "@/utils/recent-arrangement-copy";
import {
  buildPantrySummaryHint,
  buildPantrySummaryState,
  hasPantrySummaryData as resolveHasPantrySummaryData
} from "./pantry-summary";

const heroAssetBase = `${cfg.domain}/static/uploads/material-store`;
const heroImagePrimary = `${heroAssetBase}/e499ecd9-4821-44ee-ab05-db2124e759e0.png?v=2026-09-05T11%3A50%3A52.021Z`;
const heroImageSecondary = `${heroAssetBase}/bffc3b08-a6c0-4a4f-91a4-96fc9a242751.png?v=2026-09-05T11%3A51%3A08.293Z`;

const pageStyle = usePageScrollStyle();
const settingsStore = useSettingsStore();
const { themeVars, themeClasses, effectiveSkin, effectivePalette, themeMode, canSwitchPalette } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const currentThemeText = computed(() => formatThemeText(themeMode.value, effectiveSkin.value, effectivePalette.value, canSwitchPalette.value));

const HOME_NAV_GAP = 16;
const HOME_NAV_FADE_DISTANCE = 96;
const HIDDEN_HOME_TARGET_PREFIXES = ["/pages_restaurant/", "/pages_meal/poll/index", "/pages_meal/wish/index", "/pages_meal/result/index"];
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const homeScrollTop = ref(0);
const pendingLoginPrompt = ref<"random" | null>(null);
const homeEntriesLoading = ref(false);
const homeEntriesLoaded = ref(false);
const homeEntriesRequestBlocked = ref(false);
const featureEntryItems = ref<HomeEntryItem[]>([]);
const quickEntryItems = ref<HomeEntryItem[]>([]);
const nextMealStateLoading = ref(false);
const nextMealStateLoaded = ref(false);
const nextMealState = ref<HomeNextMealState | null>(null);
const weekOverviewLoading = ref(false);
const weekOverviewLoaded = ref(false);
const weekOverview = ref<HomeWeekOverview | null>(null);
const fridgeRecipesLoading = ref(false);
const fridgeRecipesLoaded = ref(false);
const fridgeRecipes = ref<HomeFridgeRecipeItem[]>([]);
const fridgeRecipePageIndex = ref(0);
const pantrySummaryLoading = ref(false);
const pantrySummaryLoaded = ref(false);
const pantryIngredientCount = ref(0);
const pantryExpiringCount = ref(0);
const pantryPendingShoppingCount = ref(0);
const pantryActiveListCount = ref(0);
let homeEntriesLoadPromise: Promise<void> | null = null;
let nextMealStateLoadPromise: Promise<void> | null = null;
let weekOverviewLoadPromise: Promise<void> | null = null;
let fridgeRecipesLoadPromise: Promise<void> | null = null;
let pantrySummaryLoadPromise: Promise<void> | null = null;
const heroSwiperCurrent = ref(0);
const homeFridgeRecipeDisplayCount = 3;

const heroStyle = computed(() => ({}));
const navProgress = computed(() => Math.min(1, Math.max(0, homeScrollTop.value / HOME_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));

const navGreeting = computed(() => resolveNavGreeting(new Date().getHours()));
const mainFeatureCard = computed(() => featureEntryItems.value.find(item => item.placement === "MAIN") ?? null);
const sideFeatureCards = computed(() =>
  featureEntryItems.value
    .filter(item => item.placement === "SIDE_TOP" || item.placement === "SIDE_BOTTOM")
    .sort((left, right) => (left.placement === "SIDE_TOP" ? 0 : 1) - (right.placement === "SIDE_TOP" ? 0 : 1))
);
const heroEntries = computed(() => {
  const items = [mainFeatureCard.value, ...sideFeatureCards.value].filter((item): item is HomeEntryItem => Boolean(item));
  return items.slice(0, 2);
});
const heroSlides = computed(() => {
  const fallbackItems = [
    {
      key: "hero-primary",
      entry: heroEntries.value[0] ?? null,
      imageUrl: heroImagePrimary,
      eyebrow: "本周厨房主题",
      title: heroEntries.value[0]?.title ?? "今晚吃什么？",
      description: heroEntries.value[0]?.subtitle ?? "这一周吃什么，可以慢慢安排。",
      actionText: heroEntries.value[0]?.targetType === "WEB_VIEW" ? "查看专题" : "去看看"
    },
    {
      key: "hero-secondary",
      entry: heroEntries.value[1] ?? heroEntries.value[0] ?? null,
      imageUrl: heroImageSecondary,
      eyebrow: "今日餐桌灵感",
      title: heroEntries.value[1]?.title ?? "看看今天能做什么",
      description: heroEntries.value[1]?.subtitle ?? "从首页入口继续往下安排这一顿。",
      actionText: (heroEntries.value[1] ?? heroEntries.value[0])?.targetType === "WEB_VIEW" ? "查看专题" : "去看看"
    }
  ];
  return fallbackItems;
});
const quickEntryPlacementList: HomeEntryPlacement[] = ["QUICK_1", "QUICK_2", "QUICK_3", "QUICK_4"];
const hasFeatureEntries = computed(() => Boolean(mainFeatureCard.value) && sideFeatureCards.value.length === 2);
const hasQuickEntries = computed(() => quickEntryItems.value.length > 0);
const showFeatureEntriesSkeleton = computed(() => !hasFeatureEntries.value && (homeEntriesLoading.value || !homeEntriesLoaded.value));
const showQuickEntriesSkeleton = computed(() => !hasQuickEntries.value && (homeEntriesLoading.value || !homeEntriesLoaded.value));
const showWeekOverviewSkeleton = computed(() => sessionStore.isLoggedIn && weekOverviewLoading.value && !weekOverviewLoaded.value);
const showFridgeRecipesSkeleton = computed(
  () =>
    sessionStore.isLoggedIn &&
    !fridgeRecipes.value.length &&
    (fridgeRecipesLoading.value || !fridgeRecipesLoaded.value || (pantrySummaryLoading.value && !pantrySummaryLoaded.value))
);
const showPantrySummarySkeleton = computed(
  () => sessionStore.isLoggedIn && !pantrySummaryLoaded.value && pantrySummaryLoading.value
);
const hasPantrySummaryData = computed(
  () =>
    resolveHasPantrySummaryData({
      ingredientCount: pantryIngredientCount.value,
      expiringCount: pantryExpiringCount.value,
      pendingShoppingCount: pantryPendingShoppingCount.value,
      activeListCount: pantryActiveListCount.value
    })
);
const pantrySummaryItems = computed(() => [
  { label: "冰箱食材", value: String(pantryIngredientCount.value) },
  { label: "临期待处理", value: String(pantryExpiringCount.value) },
  { label: "待采购", value: String(pantryPendingShoppingCount.value) }
]);
const pantrySummaryHintText = computed(() => {
  return buildPantrySummaryHint({
    ingredientCount: pantryIngredientCount.value,
    expiringCount: pantryExpiringCount.value,
    pendingShoppingCount: pantryPendingShoppingCount.value,
    activeListCount: pantryActiveListCount.value
  });
});
const visibleFridgeRecipes = computed(() => {
  const items = fridgeRecipes.value;
  if (items.length <= homeFridgeRecipeDisplayCount) return items;

  const startIndex = (fridgeRecipePageIndex.value * homeFridgeRecipeDisplayCount) % items.length;
  return Array.from({ length: homeFridgeRecipeDisplayCount }, (_, index) => items[(startIndex + index) % items.length]);
});
const hasFridgeIngredients = computed(() => pantryIngredientCount.value > 0);
const fridgeRecipesEmptyTitle = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后看看能做什么";
  return hasFridgeIngredients.value ? "还没匹配到合适的菜" : "先记几样冰箱食材";
});
const fridgeRecipesEmptyDescription = computed(() => {
  if (!sessionStore.isLoggedIn) return "记下冰箱里的食材后，这里会按已有食材匹配菜谱。";
  if (hasFridgeIngredients.value) return "可以去菜谱里找找想吃的，或先随机一桌换个思路。";
  return "有了食材记录，首页就能帮你挑更顺手的菜。";
});
const fridgeRecipesEmptyPrimaryActionText = computed(() => (hasFridgeIngredients.value ? "去看食谱" : "去记食材"));
const homeNextStatus = computed<HomeNextMealStatus>(() => nextMealState.value?.status ?? "NO_ARRANGEMENT");
const weekOverviewState = computed<HomeWeekOverview | null>(() => weekOverview.value);
const weekOverviewStatus = computed<HomeWeekOverviewStatus>(() => weekOverviewState.value?.status ?? "NO_ARRANGEMENT");
const currentWeekIconClass = computed(() => {
  const day = new Date().getDay();
  const iconMap = [
    "icon-week-sun",
    "icon-week-mon",
    "icon-week-tue",
    "icon-week-wed",
    "icon-week-thu",
    "icon-week-fri",
    "icon-week-sat"
  ] as const;
  return iconMap[day] ?? "icon-week-thu";
});
const weekOverviewSummary = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后再看这周怎么安排。";
  if (showWeekOverviewSkeleton.value) return "正在整理这周安排。";
  return weekOverviewState.value?.summary ?? "先安排几顿";
});
const weekOverviewActionText = computed(() => {
  if (!sessionStore.isLoggedIn) return "去安排";
  return weekOverviewState.value?.actionText ?? "去安排";
});
const recentArrangement = computed(() => nextMealState.value?.arrangement ?? null);
const showRecentArrangementCard = computed(() => Boolean(recentArrangement.value));
const showRecentArrangementSkeleton = computed(
  () => sessionStore.isLoggedIn && nextMealStateLoading.value && !nextMealStateLoaded.value
);
const recentArrangementMeta = computed(() => {
  if (!recentArrangement.value) return "";
  return [
    formatRecentArrangementTime(recentArrangement.value),
    `${recentArrangement.value.participantCount}人`,
    `${recentArrangement.value.menuCount}道菜`
  ].join(" · ");
});
const recentArrangementStatusText = computed(() => (recentArrangement.value ? recentArrangementCopyPicker.statusText(recentArrangement.value) : ""));
const recentArrangementHintText = computed(() => (recentArrangement.value ? recentArrangementCopyPicker.hintText(recentArrangement.value) : ""));

onLoad(query => {
  pendingLoginPrompt.value = parseHomeLoginPrompt(query?.login);
});

onShow(() => {
  openPendingLoginPrompt();
  void useAppConfigStore().refreshForHomeShow();
  void Promise.all([loadHomeEntries(), loadNextMealState(true), loadWeekOverview(true), loadFridgeRecipes(true), loadPantrySummary(true)]);
});

function parseHomeLoginPrompt(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "random" ? "random" : null;
}

function openPendingLoginPrompt() {
  if (!pendingLoginPrompt.value || sessionStore.isLoggedIn) return;
  pendingLoginPrompt.value = null;
  openLogin();
}

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

async function loadWeekOverview(force = false) {
  if (!sessionStore.isLoggedIn) {
    weekOverview.value = null;
    weekOverviewLoading.value = false;
    weekOverviewLoaded.value = false;
    return;
  }

  if (weekOverviewLoadPromise) {
    await weekOverviewLoadPromise;
    return;
  }

  if (!force && weekOverviewLoaded.value) return;

  weekOverviewLoading.value = true;
  weekOverviewLoadPromise = homeApi
    .getWeekOverview()
    .then(result => {
      weekOverview.value = result;
      weekOverviewLoaded.value = true;
    })
    .catch(() => {
      weekOverview.value = null;
      weekOverviewLoaded.value = true;
    })
    .finally(() => {
      weekOverviewLoading.value = false;
      weekOverviewLoadPromise = null;
    });

  await weekOverviewLoadPromise;
}

async function loadFridgeRecipes(force = false) {
  if (!sessionStore.isLoggedIn) {
    fridgeRecipes.value = [];
    fridgeRecipePageIndex.value = 0;
    fridgeRecipesLoading.value = false;
    fridgeRecipesLoaded.value = false;
    return;
  }

  if (fridgeRecipesLoadPromise) {
    await fridgeRecipesLoadPromise;
    return;
  }

  if (!force && fridgeRecipesLoaded.value) return;

  fridgeRecipesLoading.value = true;
  fridgeRecipesLoadPromise = homeApi
    .getFridgeRecipes()
    .then(result => {
      fridgeRecipes.value = result.items;
      fridgeRecipePageIndex.value = 0;
      fridgeRecipesLoaded.value = true;
    })
    .catch(() => {
      fridgeRecipes.value = [];
      fridgeRecipePageIndex.value = 0;
      fridgeRecipesLoaded.value = true;
    })
    .finally(() => {
      fridgeRecipesLoading.value = false;
      fridgeRecipesLoadPromise = null;
    });

  await fridgeRecipesLoadPromise;
}

async function loadPantrySummary(force = false) {
  if (!sessionStore.isLoggedIn) {
    pantryIngredientCount.value = 0;
    pantryExpiringCount.value = 0;
    pantryPendingShoppingCount.value = 0;
    pantryActiveListCount.value = 0;
    pantrySummaryLoading.value = false;
    pantrySummaryLoaded.value = false;
    return;
  }

  if (pantrySummaryLoadPromise) {
    await pantrySummaryLoadPromise;
    return;
  }

  if (!force && pantrySummaryLoaded.value) return;

  pantrySummaryLoading.value = true;
  pantrySummaryLoadPromise = Promise.allSettled([fridgeApi.getSummary(), shoppingApi.getListSummary()])
    .then(([fridgeResult, shoppingResult]) => {
      const next = buildPantrySummaryState(
        fridgeResult.status === "fulfilled" ? fridgeResult.value : null,
        shoppingResult.status === "fulfilled" ? shoppingResult.value : null
      );
      pantryIngredientCount.value = next.ingredientCount;
      pantryExpiringCount.value = next.expiringCount;
      pantryPendingShoppingCount.value = next.pendingShoppingCount;
      pantryActiveListCount.value = next.activeListCount;
      pantrySummaryLoaded.value = true;
    })
    .catch(() => {
      pantryIngredientCount.value = 0;
      pantryExpiringCount.value = 0;
      pantryPendingShoppingCount.value = 0;
      pantryActiveListCount.value = 0;
      pantrySummaryLoaded.value = true;
    })
    .finally(() => {
      pantrySummaryLoading.value = false;
      pantrySummaryLoadPromise = null;
    });

  await pantrySummaryLoadPromise;
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

function resolveQuickEntryTitle(item: HomeEntryItem) {
  if (item.placement === "QUICK_1") return "安排下一顿";
  if (item.placement === "QUICK_2") return "看看食材";
  if (item.placement === "QUICK_3") return "随机一桌";
  return "补缺食材";
}

function resolveNavGreeting(hour: number) {
  if (hour >= 1 && hour < 7) {
    return {
      title: "晚安。",
      subtitle: "被我抓到你熬夜啦！"
    };
  }
  if (hour >= 7 && hour < 11) {
    return {
      title: "早安。",
      subtitle: "厨房今天也该有点香气了。"
    };
  }
  if (hour >= 11 && hour < 14) {
    return {
      title: "午安。",
      subtitle: "这会儿，适合认真吃一顿。"
    };
  }
  if (hour >= 14 && hour < 17) {
    return {
      title: "午后好。",
      subtitle: "先给今天加一口松弛感。"
    };
  }
  if (hour >= 17 && hour < 21) {
    return {
      title: "晚上好。",
      subtitle: "今晚准备吃点什么？"
    };
  }
  return {
    title: "夜深了。",
    subtitle: "要不要来点夜宵？"
  };
}

function isVisibleHomeEntry(targetValue: string) {
  return !HIDDEN_HOME_TARGET_PREFIXES.some(prefix => targetValue.startsWith(prefix));
}

function openHomeEntry(item: HomeEntryItem | null) {
  if (!item) return;
  if (requiresLoginForQuickEntry(item) && !sessionStore.isLoggedIn) {
    openLogin(() => {
      openHomeEntry(item);
    });
    return;
  }

  if (item.targetType === "WEB_VIEW") {
    if (!/^https:\/\//iu.test(item.targetValue)) return;
    navigateTo(`/pages_web/content/index?url=${encodeURIComponent(item.targetValue)}`);
    return;
  }

  navigateTo(item.targetValue);
}

function openWeekOverview() {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openWeekOverview();
    });
    return;
  }
  navigateTo(weekOverviewState.value?.targetValue || "/pages_meal/plan/index");
}

function openQuickEntry(item: HomeEntryItem) {
  if (item.placement === "QUICK_1") {
    if (!sessionStore.isLoggedIn) {
      openLogin(() => {
        openQuickEntry(item);
      });
      return;
    }
    navigateTo(weekOverviewState.value?.targetValue || "/pages_meal/plan/index");
    return;
  }
  if (item.placement === "QUICK_2") {
    if (!sessionStore.isLoggedIn) {
      openLogin(() => {
        openQuickEntry(item);
      });
      return;
    }
    navigateTo("/pages_pantry/index/index");
    return;
  }
  if (item.placement === "QUICK_3") {
    openRandomEntry();
    return;
  }
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openQuickEntry(item);
    });
    return;
  }
  navigateTo(pantryActiveListCount.value > 0 ? "/pages_pantry/list/index" : "/pages_pantry/gap/index");
}

function requiresLoginForQuickEntry(item: HomeEntryItem) {
  if (item.placement !== "QUICK_1" && item.placement !== "QUICK_2" && item.placement !== "QUICK_3" && item.placement !== "QUICK_4") {
    return false;
  }

  return (
    item.targetValue === "/pages_meal/plan/index" ||
    item.targetValue === "/pages_meal/random/index" ||
    item.targetValue === "/pages_pantry/index/index" ||
    item.targetValue === "/pages_pantry/gap/index"
  );
}

function openRandomEntry() {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openRandomEntry();
    });
    return;
  }
  navigateTo("/pages_meal/random/index");
}

async function refreshFridgeRecipeRecommendations() {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void refreshFridgeRecipeRecommendations();
    });
    return;
  }

  if (fridgeRecipes.value.length > homeFridgeRecipeDisplayCount) {
    fridgeRecipePageIndex.value += 1;
    return;
  }

  await loadFridgeRecipes(true);
}

function openFridgeEmptyPrimaryAction() {
  if (hasFridgeIngredients.value) {
    navigateTo("/pages/recipe/index");
    return;
  }
  navigateTo("/pages_pantry/index/index");
}

function openLogin(action: (() => void) | null = null) {
  loginModalStore.open(null, action);
}

function openFridgeRecipe(item: HomeFridgeRecipeItem) {
  const kind = item.kind === "MY" ? "my" : "inspiration";
  navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.recipeId))}&kind=${kind}`);
}

function fridgeFitText(value: HomeFridgeRecipeItem["fridgeFit"]) {
  if (value === "HIGH") return "现在就能做";
  if (value === "MEDIUM") return "差一点就能做";
  return "再补两样";
}

function fridgeRecipeMeta(item: HomeFridgeRecipeItem) {
  const segments = [item.durationText || "时长待补"];
  if (item.missingIngredientCount > 0) {
    segments.push(`还差${item.missingIngredientCount}样`);
  } else {
    segments.push(`已配上${item.matchedIngredientCount}样`);
  }
  return segments.join(" · ");
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

function handleHeroSwiperChange(event: { detail?: { current?: number } }) {
  heroSwiperCurrent.value = event.detail?.current ?? 0;
}

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
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

function readComputedStyle(selector: string, styleNames: string[]) {
  return new Promise<Record<string, string>>((resolve) => {
    uni
      .createSelectorQuery()
      .select(selector)
      .fields({ computedStyle: styleNames } as never, (result) => {
        resolve((result as Record<string, string> | null) ?? {});
      })
      .exec();
  });
}

async function readThemeProbeState() {
  const [inputStyle] = await Promise.all([readComputedStyle(".theme-probe__input", ["borderTopColor"])]);

  return {
    materialInputBorder: inputStyle.borderTopColor
  };
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  await Promise.all([loadHomeEntries(true), loadNextMealState(true), loadWeekOverview(true), loadFridgeRecipes(true), loadPantrySummary(true)]);
}

async function automatorApplySessionOnly(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
}

async function automatorClearSession() {
  loginModalStore.close();
  await sessionStore.clearSession();
  await Promise.all([loadNextMealState(true), loadWeekOverview(true), loadFridgeRecipes(true), loadPantrySummary(true)]);
}

async function buildAutomatorThemeState() {
  const probeState = await readThemeProbeState();
  return {
    themeMode: themeMode.value,
    effectiveSkin: effectiveSkin.value,
    effectivePalette: effectivePalette.value,
    canSwitchPalette: canSwitchPalette.value,
    currentThemeText: currentThemeText.value,
    themePageStyle: themePageStyle.value,
    colorPage: themeVars.value["--color-page"] ?? "",
    pagePrimarySoftBg: themeVars.value["--page-primary-soft-bg"] ?? "",
    materialCardBorder: themeVars.value["--material-card-border"] ?? "",
    materialInputBorder: probeState.materialInputBorder ?? themeVars.value["--material-input-border"] ?? "",
    materialControlBorder: themeVars.value["--material-control-border"] ?? "",
    materialTabbarBorder: themeVars.value["--material-tabbar-border"] ?? "",
    buttonSecondaryBorder: themeVars.value["--button-secondary-border"] ?? ""
  };
}

function automatorReadRecentArrangementState() {
  return {
    homeNextStatus: homeNextStatus.value,
    weekOverviewStatus: weekOverviewStatus.value,
    arrangementStatus: recentArrangement.value?.status ?? "",
    weekOverviewTarget: weekOverviewState.value?.targetValue ?? "/pages_meal/plan/index",
    cardPrimaryTarget: recentArrangement.value
      ? buildRecentArrangementDetailUrl(recentArrangement.value, resolveRecentArrangementFocus(recentArrangement.value.status))
      : "",
    cardDetailTarget: recentArrangement.value ? buildRecentArrangementDetailUrl(recentArrangement.value) : ""
  };
}

function automatorReadLoginGateState() {
  return {
    loggedIn: sessionStore.isLoggedIn,
    loginVisible: loginModalStore.visible
  };
}

async function automatorResetThemeSettings() {
  await settingsStore.clearSettings();
  return await buildAutomatorThemeState();
}

async function automatorApplyThemeSettings(snapshot: {
  themeMode?: ThemeMode;
  themeSkin?: ThemeSkin;
  themePalette?: ThemePalette;
}) {
  if (snapshot.themeMode) {
    await settingsStore.setThemeMode(snapshot.themeMode);
  }
  if (snapshot.themeSkin) {
    await settingsStore.setThemeSkin(snapshot.themeSkin);
  }
  if (snapshot.themePalette) {
    await settingsStore.setThemePalette(snapshot.themePalette);
  }
  return await buildAutomatorThemeState();
}

defineExpose({
  automatorApplySession,
  automatorApplySessionOnly,
  automatorClearSession,
  automatorReadRecentArrangementState,
  automatorReadLoginGateState,
  automatorResetThemeSettings,
  automatorApplyThemeSettings
});
</script>

<style scoped lang="scss">
.home-nav-backdrop {
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

.table-scroll {
  height: 100%;
  background: var(--color-page);
}

.table-page {
  min-height: 100%;
}

.theme-probe {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  width: 0;
  height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}

.theme-probe__input {
  border: 1rpx solid var(--material-input-border);
  background: var(--material-input-bg);
}

.theme-probe__control {
  background: var(--material-control-bg);
}

.table-hero {
  position: relative;
  overflow: hidden;
  height: 680rpx;
  border-bottom-right-radius: 42rpx;
  border-bottom-left-radius: 42rpx;
  background: var(--page-hero-shell-bg);
}

.table-hero::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--page-hero-mask-bg);
  pointer-events: none;
  content: "";
}

.table-hero::after {
  position: absolute;
  left: 0;
  bottom: -10rpx;
  z-index: 2;
  width: 100%;
  height: 140rpx;
  background: var(--page-hero-orb-bg);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
  content: "";
}

.table-nav__selector {
  width: 100%;
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
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.restaurant-bar__name {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-swiper,
.hero-swiper__item {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
}

.hero-banner {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-shadow: var(--material-card-shadow);
}

.hero-banner__shade,
.hero-banner__image {
  position: absolute;
  inset: 0;
}

.hero-banner__shade {
}

.hero-banner__image {
  width: 100%;
  height: 100%;
}

.hero-banner__copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  padding: calc(36rpx + var(--status-bar-height, 0px) + 88rpx) var(--space-page) 164rpx;
}

.hero-banner__eyebrow,
.hero-banner__title,
.hero-banner__description {
  display: block;
  color: var(--color-text);
}

.hero-banner__eyebrow {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  opacity: 0.78;
}

.hero-banner__title {
  margin-top: 14rpx;
  font-size: 46rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.08;
}

.hero-banner__description {
  margin-top: 14rpx;
  max-width: 520rpx;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  opacity: 0.92;
}

.hero-banner__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 130rpx;
  height: 60rpx;
  margin: 22rpx 0;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-overlay-control);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
}

.hero-banner__action-text {
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
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
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero-copy__title {
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: 58rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.04;
}

.hero-copy__description {
  margin-top: 20rpx;
  color: var(--color-text-tertiary);
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
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.hero-copy__button--ghost {
  background: var(--button-secondary-bg);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.hero-copy__button-text {
  color: var(--color-text-inverse);
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
  border: 4rpx solid var(--color-illustration-ink);
  border-radius: 50%;
  background: var(--color-illustration-plate);
  box-shadow: var(--shadow-illustration);
  transform: rotate(-8deg);
}

.table-scene__rice {
  position: absolute;
  top: 34rpx;
  left: 66rpx;
  width: 78rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--color-illustration-rice);
  box-shadow:
    -38rpx 12rpx 0 var(--color-illustration-warm),
    42rpx 10rpx 0 var(--color-illustration-fresh),
    4rpx 44rpx 0 var(--color-illustration-sunny);
}

.table-scene__leaf {
  position: absolute;
  width: 68rpx;
  height: 30rpx;
  border: 4rpx solid var(--color-illustration-ink);
  border-radius: 50%;
  background: var(--color-illustration-leaf-soft);
}

.table-scene__leaf--left {
  top: -12rpx;
  left: 22rpx;
  transform: rotate(-28deg);
}

.table-scene__leaf--right {
  right: 18rpx;
  bottom: 10rpx;
  background: var(--color-illustration-leaf-strong);
  transform: rotate(-20deg);
}

.table-scene__egg {
  position: absolute;
  top: 50rpx;
  right: 48rpx;
  width: 46rpx;
  height: 46rpx;
  border: 4rpx solid var(--color-illustration-ink);
  border-radius: 50%;
  background: var(--color-illustration-egg);
}

.table-scene__bowl {
  position: absolute;
  right: 306rpx;
  bottom: 54rpx;
  width: 128rpx;
  height: 88rpx;
  border: 4rpx solid var(--color-illustration-ink);
  border-radius: 28rpx 28rpx 68rpx 68rpx;
  background: var(--color-illustration-bowl);
  box-shadow: var(--shadow-illustration);
  transform: rotate(7deg);
}

.table-scene__cup {
  position: absolute;
  right: 40rpx;
  bottom: 56rpx;
  width: 66rpx;
  height: 78rpx;
  border: 4rpx solid var(--color-illustration-ink);
  border-radius: 18rpx 18rpx 28rpx 28rpx;
  background: var(--color-illustration-cup);
  transform: rotate(-10deg);
}

.table-content {
  position: relative;
  z-index: 3;
  margin-top: -200rpx;
  padding: 50rpx var(--space-page) calc(32rpx + var(--tabbar-shell-height) + env(safe-area-inset-bottom));
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
  padding: 28rpx;
  background: var(--color-illustration-panel-warm);
}

.feature-card--status {
  display: flex;
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
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
  background: var(--color-illustration-panel-fresh);
}

.feature-card--green {
  background: var(--color-illustration-panel-accent);
}

.feature-card__title-row {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.feature-card__copy--status {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100%;
}

.feature-card__status-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.feature-card__weekmark-icon {
  color: var(--color-text);
  line-height: 1;
  flex-shrink: 0;
}

.feature-card__title,
.feature-card__subtitle {
  position: relative;
  z-index: 2;
  display: block;
}

.feature-card__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.feature-card__status-action-text {
  position: relative;
  z-index: 2;
  display: block;
}

.feature-card__subtitle {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-normal);
}

.feature-card__copy--status .feature-card__title {
  font-size: 36rpx;
  line-height: 1.18;
}

.feature-card__copy--status .feature-card__subtitle {
  margin-top: 18rpx;
}

.feature-card__status-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  height: 56rpx;
  margin-top: 20rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-pill);
  background: var(--button-secondary-bg);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.feature-card__status-action-text {
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.feature-card__art {
  position: absolute;
  right: 20rpx;
  bottom: 20rpx;
  left: 20rpx;
  height: 160rpx;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
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
  border: 5rpx solid var(--color-illustration-ink);
  border-radius: 50%;
  background: var(--color-illustration-plate);
  transform: translateX(-50%) rotate(-6deg);
}

.feature-card__food {
  position: absolute;
  top: 22rpx;
  left: 42rpx;
  width: 48rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--color-illustration-rice);
  box-shadow:
    -24rpx 8rpx 0 var(--color-illustration-warm),
    26rpx 7rpx 0 var(--color-illustration-fresh),
    3rpx 28rpx 0 var(--color-illustration-sunny);
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
  color: var(--color-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
}

.feature-card__mini-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: var(--radius-pill);
  background: var(--color-illustration-sunny);
  box-shadow: var(--shadow-illustration-dot);
}

.action-dock {
  display: flex;
  justify-content: space-evenly;
  margin-top: 50rpx;
}

.recent-arrangement {
  margin: 50rpx 0;
  position: relative;
  padding-top: 20rpx;
  padding-left: 12rpx;
  padding-right: 12rpx;
}

.recent-arrangement__panel {
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  position: relative;
  z-index: 2;
}

.recent-arrangement__stack {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.recent-arrangement__back {
  position: absolute;
  inset: 18rpx 0 0 0;
  border-radius: var(--radius-xs);
  background: var(--page-cover-fresh-bg);
  box-shadow: var(--shadow-card);
  transform-origin: center top;
}

.recent-arrangement__back--near {
  inset-left: 10rpx;
  inset-right: 10rpx;
  transform: rotate(-1.6deg);
  opacity: 0.72;
}

.recent-arrangement__back--far {
  inset-top: 24rpx;
  inset-left: 20rpx;
  inset-right: 20rpx;
  transform: rotate(2.2deg);
  opacity: 0.5;
  transform-origin: center bottom;
}

.recent-arrangement--hover {
  .recent-arrangement__panel,
  .recent-arrangement__back {
    opacity: 0.9;
  }
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
.recent-arrangement__status,
.recent-arrangement__hint {
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

.recent-arrangement__status--head {
  flex: 0 0 auto;
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
  text-align: right;
}

.recent-arrangement__meta {
  margin-top: 18rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.recent-arrangement__status {
  color: var(--color-support-action);
}

.recent-arrangement__hint {
  margin: 18rpx 0;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.recent-arrangement__actions {
  gap: 18rpx;
  justify-content: flex-end;
}

.recent-arrangement__actions--skeleton {
  justify-content: flex-start;
}

.recent-arrangement__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 164rpx;
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.recent-arrangement__button-text {
  color: var(--color-text-inverse);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
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
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.dock-action__icon.quick-action--primary {
  background: var(--color-tag-primary-bg);
}

.dock-action__icon.quick-action--mint {
  background: var(--color-surface-muted);
}

.dock-action__icon.quick-action--aqua {
  background: var(--color-tag-secondary-bg);
}

.dock-action__icon.quick-action--soft {
  background: var(--color-surface-muted);
}

.dock-action__image {
  width: 100%;
  height: 100%;
}

.dock-action__badge {
  color: var(--color-tag-primary-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.dock-action__dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-illustration-sunny);
  box-shadow: var(--shadow-illustration-dot);
}

.dock-action__title {
  display: block;
  margin-top: 24rpx;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-align: center;
}

.decision-card,
.table-section {
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.decision-card {
  overflow: hidden;
  padding: 30rpx;
  border-radius: var(--radius-card);
  background: var(--material-card-bg);
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
  color: var(--color-support-action);
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
  background: var(--color-tag-primary-bg);
}

.decision-card__badge-text {
  color: var(--color-tag-primary-text);
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
  background: var(--color-tag-primary-bg);
}

.candidate-item__rank-text {
  color: var(--color-tag-primary-text);
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
  color: var(--color-support-action);
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
  background: var(--button-primary-bg);
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
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.table-section {
  margin-top: 50rpx;
  padding: 28rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.section-heading__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}

.section-heading__eyebrow {
  display: block;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.section-heading__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.section-heading__action {
  color: var(--color-support-action);
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
  background: var(--color-tag-primary-bg);
}

.feed-item__avatar--green {
  background: var(--color-surface-muted);
}

.feed-item__avatar--blue {
  background: var(--color-tag-secondary-bg);
}

.feed-item__avatar-text {
  color: var(--color-tag-primary-text);
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
  margin-top: 50rpx;
  padding: 28rpx;
  border-radius: var(--radius-xs);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  background: var(--color-illustration-panel-accent);
}

.pantry-panel__header {
  align-items: center;
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 164rpx;
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  box-sizing: border-box;
}

.pantry-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.pantry-summary {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.pantry-summary__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.pantry-summary__stat {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx 18rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-raised);
}

.pantry-summary__value,
.pantry-summary__label,
.pantry-summary__hint {
  display: block;
}

.pantry-summary__value {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.pantry-summary__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.pantry-summary__hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.pantry-item {
  align-items: center;
  min-height: 72rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-soft);
}

.pantry-item__dot {
  flex: 0 0 auto;
  width: 16rpx;
  height: 16rpx;
  border-radius: var(--radius-pill);
}

.pantry-item__dot--danger {
  background: var(--color-state-danger-base);
}

.pantry-item__dot--warning {
  background: var(--color-state-warning-base);
}

.pantry-item__dot--ok {
  background: var(--color-state-success-base);
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

.recipe-scroll {
  width: 100%;
  white-space: nowrap;
}

.fridge-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.fridge-empty__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 164rpx;
  height: 60rpx;
  padding: 0 26rpx;
  border-radius: var(--radius-pill);
  box-sizing: border-box;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.fridge-empty__button--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.fridge-empty__button--secondary {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
}

.family-recipe {
  display: inline-block;
  width: 240rpx;
  margin-right: 28rpx;
  vertical-align: top;
}

.family-recipe:last-child {
  margin-right: 0;
}

.family-recipe--skeleton:not(:last-child) {
  margin-right: 44rpx;
}

.family-recipe__visual {
  position: relative;
  overflow: hidden;
  height: 180rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-raised);
}

.family-recipe__visual--warm {
  background: var(--color-illustration-panel-warm);
}

.family-recipe__visual--fresh {
  background: var(--color-illustration-panel-fresh);
}

.family-recipe__visual--cool {
  background: var(--color-illustration-panel-accent);
}

.family-recipe__plate {
  position: absolute;
  right: 24rpx;
  bottom: 50rpx;
  width: 148rpx;
  height: 104rpx;
  border: 6rpx solid var(--color-illustration-ink);
  border-radius: 50%;
  background: var(--color-illustration-plate);
  transform: rotate(-8deg);
}

.family-recipe__food {
  position: absolute;
  top: 28rpx;
  left: 50rpx;
  width: 48rpx;
  height: 38rpx;
  border-radius: 50%;
  background: var(--color-illustration-rice);
  box-shadow:
    -28rpx 8rpx 0 var(--color-illustration-warm),
    30rpx 8rpx 0 var(--color-illustration-fresh),
    2rpx 30rpx 0 var(--color-illustration-sunny);
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
