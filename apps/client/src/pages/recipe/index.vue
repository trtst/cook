<template>
  <page-meta :page-style="themePageStyle" />
  <Layout
    :class="themeClasses"
    current-tab="recipe"
    :tabbar-hidden="isRecipeScrolling"
    :show-left="false"
    full-screen
    :navbar-capsule-guard="true"
  >
    <template #navbar-center>
      <view class="recipe-navbar">
        <view class="nav-tabs">
          <view
            v-for="item in tabs"
            :key="item.value"
            class="nav-tabs__item font-medium"
            :class="{
              'nav-tabs__item--active': activeTab === item.value,
              'nav-tab-active-indicator': activeTab === item.value
            }"
            @click="switchTab(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
        <view
          v-if="sessionStore.isLoggedIn && activeTab !== 'inspiration'"
          class="manage-fab"
          hover-class="manage-fab--hover"
          hover-stay-time="100"
          @click="handleFab"
        >
          <text class="cookfont icon-manage-add manage-fab__icon" />
        </view>
      </view>
    </template>

    <view class="recipe-page">
      <view class="recipe-head">
        <view class="search-row">
          <view class="search-row__inner">
            <RecipeSearchBar
              v-model="keyword"
              @confirm="searchCurrent"
              @clear="clearKeyword"
            />
          </view>
        </view>

        <view v-if="showStickyControls" class="sticky-wrap">
          <view v-if="showFilters" class="filter-overlay" @click="closeFilters" />
          <view
            v-if="showCategoryBar"
            class="sticky-bar"
            :class="{ 'sticky-bar--inspiration': activeTab === 'inspiration' }"
          >
            <view class="category-fixed">
              <view
                class="category-chip"
                :class="{ 'category-chip--active': currentCategoryId === firstCategoryItem.id }"
                @click="changeCategory(firstCategoryItem.id)"
              >
                <text class="category-chip__name">{{ firstCategoryItem.name }}</text>
              </view>
            </view>

            <scroll-view scroll-x class="category-scroll" show-scrollbar="false">
              <view class="category-row">
                <view
                  v-for="item in scrollCategoryItems"
                  :key="item.id"
                  class="category-chip"
                  :class="{ 'category-chip--active': currentCategoryId === item.id }"
                  @click="changeCategory(item.id)"
                >
                  <text class="category-chip__name">{{ item.name }}</text>
                </view>
              </view>
            </scroll-view>

            <view v-if="activeTab === 'my' || activeTab === 'inspiration'" class="filter-trigger-wrap">
              <view
                class="filter-trigger"
                :class="{ 'filter-trigger--active': showFilters || activeFilterCount > 0 }"
                @click="toggleFilters"
              >
                <text class="filter-trigger__text">筛选</text>
                <text class="cookfont icon-filter-list filter-trigger__icon" />
                <view v-if="activeFilterCount > 0" class="filter-trigger__badge">
                  {{ activeFilterBadge }}
                </view>
              </view>
            </view>
          </view>

          <view
            v-if="activeTab === 'my' || activeTab === 'inspiration'"
            class="filter-drawer"
            :class="{ 'filter-drawer--visible': showFilters }"
          >
            <view v-if="activeTab === 'inspiration'" class="filter-group">
              <text class="filter-group__title">排序</text>
              <view class="filter-group__chips">
                <view
                  v-for="item in sortItems"
                  :key="item.value"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': filterSort === item.value }"
                  @click="changeSort(item.value)"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__title">难度</text>
              <view class="filter-group__chips">
                <view
                  v-for="item in difficultyItems"
                  :key="item.value"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': filterDifficulty === item.value }"
                  @click="changeDifficulty(item.value)"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>

            <view class="filter-group">
              <text class="filter-group__title">时长</text>
              <view class="filter-group__chips">
                <view
                  v-for="item in durationItems"
                  :key="item.value"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': filterDuration === item.value }"
                  @click="changeDuration(item.value)"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>

            <view v-if="activeTab === 'my'" class="filter-group">
              <text class="filter-group__title">分类</text>
              <view class="filter-group__chips">
                <view
                  class="filter-chip"
                  :class="{ 'filter-chip--active': filterInspirationCategoryId === '' }"
                  @click="changeFilterInspirationCategory('')"
                >
                  全部
                </view>
                <view
                  v-for="item in inspirationCategories"
                  :key="item.id"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': filterInspirationCategoryId === item.id }"
                  @click="changeFilterInspirationCategory(item.id)"
                >
                  {{ item.name }}
                </view>
              </view>
            </view>

            <view class="filter-actions">
              <view class="filter-actions__button filter-actions__button--ghost" @click="resetFilters">重置</view>
              <view class="filter-actions__button filter-actions__button--primary" @click="applyFilters">确定</view>
            </view>
          </view>
        </view>
      </view>

      <view class="recipe-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
          :loading="inlineLoading"
          :loading-text="inlineLoadingText"
        />

        <swiper
          class="recipe-swiper"
          :current="recipeTabIndex"
          :duration="240"
          @change="handleRecipeSwiperChange"
        >
          <swiper-item v-for="tab in recipeTabValues" :key="tab" class="recipe-swiper-item">
            <scroll-view
              scroll-y
              :scroll-top="scrollCommandByTab[tab]"
              scroll-with-animation
              class="recipe-scroll"
              refresher-enabled
              refresher-default-style="none"
              :show-scrollbar="false"
              :refresher-threshold="refresherThreshold"
              :refresher-triggered="tab === activeTab && refresherTriggered"
              :lower-threshold="120"
              @scroll="handleRecipeScroll(tab, $event)"
              @scrolltolower="loadMoreActiveTab(tab)"
              @refresherpulling="onRefresherPulling"
              @refresherrefresh="handleRefresherRefresh(tab)"
              @refresherrestore="onRefresherRestore"
              @refresherabort="onRefresherRestore"
            >
              <Empty
                v-if="tab === activeTab && errorText"
                title="菜谱加载失败"
                description="请点击重试，或稍后再试。"
                clickable
                @click="retryLoadActiveTab"
              />
              <view
                v-else-if="!tabLoadedOnce[tab] || (tab === activeTab && loading && !tabCards[tab].length)"
                class="recipe-list-skeleton"
              >
                <view v-for="index in 4" :key="index" class="recipe-card recipe-card--skeleton">
                  <view class="recipe-card__cover recipe-card__cover--skeleton">
                    <Skeleton width="100%" height="100%" radius="0" />
                  </view>
                  <view class="recipe-card__body">
                    <Skeleton width="72%" height="30rpx" radius="8rpx" />
                    <view class="recipe-card__skeleton-meta">
                      <Skeleton width="72rpx" height="26rpx" radius="var(--radius-xs)" />
                      <Skeleton width="96rpx" height="26rpx" radius="var(--radius-xs)" />
                    </view>
                  </view>
                </view>
              </view>

              <Empty
                v-else-if="!tabCards[tab].length"
                :art="emptyStateArt"
                :title="emptyStateTitle(tab)"
                :description="emptyStateDescription(tab)"
                :clickable="tab !== 'inspiration'"
                @click="handleEmptyClick"
              />

              <view v-else class="list-shell">
                <view class="list">
                  <view
                    v-for="item in tabCards[tab]"
                    :key="item.id"
                    class="recipe-card"
                    hover-class="recipe-card--hover"
                    hover-stay-time="100"
                    @click="openCard(item)"
                  >
                    <view class="recipe-card__cover">
                      <ImageLoader class="recipe-card__cover-image" :src="item.coverImageUrl" />
                    </view>

                    <view class="recipe-card__body">
                      <text class="recipe-card__title">{{ item.title }}</text>
                      <view v-if="item.keywords.length || item.caloriesText" class="recipe-card__info">
                        <view v-if="item.keywords.length" class="recipe-card__meta">
                          <text
                            v-for="keyword in item.keywords.slice(0, 3)"
                            :key="keyword"
                            class="recipe-card__meta-tag"
                          >{{ keyword }}</text>
                        </view>
                        <text v-if="item.caloriesText" class="recipe-card__calories">{{ item.caloriesText }}</text>
                      </view>
                      <text v-if="item.subline" class="recipe-card__sub">{{ item.subline }}</text>
                      <button
                        v-if="item.kind === 'inspiration'"
                        class="recipe-card__save"
                        :class="{ 'recipe-card__save--active': item.isSavedToPrivate }"
                        :disabled="savingRecipeId === item.id"
                        @click.stop="togglePrivateSave(item)"
                      >{{ savingRecipeId === item.id ? '处理中…' : item.isSavedToPrivate ? '已收藏' : '收藏到私房菜' }}</button>
                    </view>
                  </view>
                </view>

                <LoadMore
                  v-if="tabCards[tab].length > 0 && !(tab === activeTab && errorText)"
                  :loading="loadingMore && loadingMoreTab === tab"
                  :has-next="tabHasNext[tab]"
                  :show-done="loadedMoreOnceMap[tab] && !tabHasNext[tab]"
                />
              </view>
            </scroll-view>
          </swiper-item>
        </swiper>
      </view>

      <view
        class="recipe-back-top"
        :class="{
          'recipe-back-top--scrolling': canShowBackToTop && isRecipeScrolling,
          'recipe-back-top--visible': canShowBackToTop && !isRecipeScrolling
        }"
        :aria-hidden="!canShowBackToTop"
        hover-class="recipe-back-top--hover"
        hover-stay-time="100"
        @click="scrollRecipeToTop"
      >
        <text class="cookfont recipe-back-top__icon">&#xe705;</text>
      </view>

      <SheetShell
        v-if="sheetMode"
        :visible="sheetVisible"
        title="添加菜谱"
        @close="closeSheet"
        @after-close="handleSheetAfterClose"
      >
        <view class="action-card" hover-class="action-card--hover" hover-stay-time="100" @click="openRecipeEditor">
          <view class="action-card__icon">
            <text class="action-card__icon-text">写</text>
          </view>
          <view class="action-card__main">
            <text class="action-card__name">手动添加</text>
            <text class="action-card__desc">逐项填写菜谱信息</text>
          </view>
          <text class="action-card__arrow">›</text>
        </view>

        <view class="action-card" hover-class="action-card--hover" hover-stay-time="100" @click="goToInspiration">
          <view class="action-card__icon">
            <text class="action-card__icon-text">逛</text>
          </view>
          <view class="action-card__main">
            <text class="action-card__name">从灵感挑菜</text>
            <text class="action-card__desc">切到灵感页挑选并保存到私房菜</text>
          </view>
          <text class="action-card__arrow">›</text>
        </view>

        <view class="action-card" hover-class="action-card--hover" hover-stay-time="100" @click="openManage">
          <view class="action-card__icon">
            <text class="action-card__icon-text">稿</text>
          </view>
          <view class="action-card__main">
            <text class="action-card__name">草稿和管理</text>
            <text class="action-card__desc">查看草稿箱并管理已发布菜谱</text>
          </view>
          <text class="action-card__arrow">›</text>
        </view>
      </SheetShell>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onHide, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import emptyStateIllustration from "@/assets/empty.png";
import {
	recipeApi,
	type InspirationCategorySummary,
	type InspirationRecipeSummary,
	type InspirationSort,
	type MyRecipeSummary,
	type RecipeCategorySummary,
	type RecipeDifficulty,
	type RecipeDuration
} from "@/apis/recipe";
import { UnauthorizedError, type UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import ImageLoader from "@/components/ImageLoader.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { getRecipeViewVersion, markRecipeHomeDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useRecipeTabIntentStore } from "@/stores/recipe-tab-intent";
import { useSettingsStore, type ThemeMode, type ThemePalette, type ThemeSkin } from "@/stores/settings";
import { formatThemeText } from "@/themes";
import { difficultyOptions, durationOptions } from "@/utils/recipe-meta";
import { defaultRecipeTab } from "@/utils/recipe-access";
import { APP_NAME } from "@/config/app";
import { createOperationId } from "@/utils/operation-id";

type RecipeTab = "my" | "inspiration";
type SheetMode = "" | "my";
type LoadSource = "idle" | "initial" | "search" | "refresh" | "switch" | "retry";

interface CategoryItem {
	id: UUID | "";
	name: string;
}

interface CardItem {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	contentVersionId: UUID | null;
	keywords: string[];
	estimatedCalories: number | null;
	caloriesText: string;
	subline: string;
	kind: "my" | "inspiration";
	saveId: UUID | null;
	isSavedToPrivate: boolean;
}

function isSeedCoverUrl(value: string) {
	return value.startsWith("https://example.com/recipe/") || value.startsWith("http://example.com/recipe/");
}

function resolveCoverImageUrl(value: string | null | undefined) {
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (!trimmed || isSeedCoverUrl(trimmed)) {
		return null;
	}
	return trimmed;
}

function formatCardCalories(value: number | null | undefined) {
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return "";
	}
	return `${Math.round(value)} kcal`;
}

const pageStyle = usePageScrollStyle();
const settingsStore = useSettingsStore();
const { themeVars, themeClasses, effectiveSkin, effectivePalette, themeMode, canSwitchPalette } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const recipeTabIntentStore = useRecipeTabIntentStore();
const loginModalStore = useLoginModalStore();
const currentThemeText = computed(() => {
  return formatThemeText(themeMode.value, effectiveSkin.value, effectivePalette.value, canSwitchPalette.value);
});

const pageSizeMap: Record<RecipeTab, number> = {
	my: 20,
	inspiration: 20
};
const loadingTips = [
	"帮你翻一翻今天想吃什么",
	"灶台预热中，马上端上来",
	"灵感下锅中，先闻闻香气",
	"锅铲翻两下，菜谱就到了",
	"替你把常做菜再拢一遍",
	"先备好食材，马上开炒"
];

const tabs = [
	{ value: "my" as const, label: "私房菜" },
	{ value: "inspiration" as const, label: "灵感" }
];
const recipeTabValues: RecipeTab[] = ["my", "inspiration"];
const sortItems = [
	{ value: "RECOMMENDED" as const, label: "推荐" },
	{ value: "LATEST" as const, label: "最新" }
];
const difficultyItems = [{ value: "" as const, label: "全部" }, ...difficultyOptions];
const durationItems = [{ value: "" as const, label: "全部" }, ...durationOptions];

const activeTab = ref<RecipeTab>(defaultRecipeTab(sessionStore.isLoggedIn));
const recipeTabIndex = computed(() => recipeTabValues.indexOf(activeTab.value));
const keyword = ref("");
const showFilters = ref(false);
const scrollTopByTab = ref<Record<RecipeTab, number>>({ my: 0, inspiration: 0 });
const scrollCommandByTab = ref<Record<RecipeTab, number>>({ my: 0, inspiration: 0 });
const scrollingByTab = ref<Record<RecipeTab, boolean>>({ my: false, inspiration: false });
const activeScrollTop = computed(() => scrollTopByTab.value[activeTab.value]);
const isRecipeScrolling = computed(() => scrollingByTab.value[activeTab.value]);
const backToTopThreshold = 320;
const recipeScrollStopTimers: Partial<Record<RecipeTab, ReturnType<typeof setTimeout>>> = {};
const loading = ref(false);
const loadingTab = ref<RecipeTab | null>(null);
const loadingMore = ref(false);
const loadingMoreTab = ref<RecipeTab | null>(null);
const errorText = ref("");
const tabLoadedOnce = ref<Record<RecipeTab, boolean>>({ my: false, inspiration: false });
let pendingTabLoad: { tab: RecipeTab; options: { force?: boolean; source?: LoadSource } } | null = null;
const myCategories = ref<RecipeCategorySummary[]>([]);
const inspirationCategories = ref<InspirationCategorySummary[]>([]);
const myCategoryId = ref<UUID | "">("");
const inspirationCategoryId = ref<UUID | "">("");
const myInspirationCategoryId = ref<UUID | "">("");
const myDifficulty = ref<RecipeDifficulty | "">("");
const myDuration = ref<RecipeDuration | "">("");
const inspirationSort = ref<InspirationSort>("RECOMMENDED");
const inspirationDifficulty = ref<RecipeDifficulty | "">("");
const inspirationDuration = ref<RecipeDuration | "">("");
const filterSort = ref<InspirationSort>("RECOMMENDED");
const filterDifficulty = ref<RecipeDifficulty | "">("");
const filterDuration = ref<RecipeDuration | "">("");
const filterInspirationCategoryId = ref<UUID | "">("");
const myRecipes = ref<MyRecipeSummary[]>([]);
const inspirationRecipes = ref<InspirationRecipeSummary[]>([]);
const savingRecipeId = ref<UUID | null>(null);
const loginIntentTab = ref<RecipeTab | null>(null);
const sheetMode = ref<SheetMode>("");
const sheetVisible = ref(false);
const loadedVersions = ref<Record<RecipeTab, number | null>>({
	my: null,
	inspiration: null
});
const loadedKeywords = ref<Record<RecipeTab, string>>({
	my: "",
	inspiration: ""
});
const tabPage = ref<Record<RecipeTab, number>>({
	my: 0,
	inspiration: 0
});
const tabHasNext = ref<Record<RecipeTab, boolean>>({
	my: false,
	inspiration: false
});
const loadSource = ref<LoadSource>("idle");
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recipe-page-sheet"));
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
		pulling: "下拉刷新菜谱",
		canRelease: loadingTips,
		success: "刷新成功"
	}
});

const categoryItems = computed<CategoryItem[]>(() => {
	if (activeTab.value === "my") {
		return [{ id: "", name: "全部" }, ...myCategories.value.map(item => ({ id: item.id, name: item.name }))];
	}
	if (activeTab.value === "inspiration") {
		return [{ id: "", name: "全部" }, ...inspirationCategories.value.map(item => ({ id: item.id, name: item.name }))];
	}
	return [{ id: "", name: "全部" }, ...myCategories.value.map(item => ({ id: item.id, name: item.name }))];
});
const firstCategoryItem = computed<CategoryItem>(() => categoryItems.value[0] || { id: "", name: "全部" });
const scrollCategoryItems = computed<CategoryItem[]>(() => categoryItems.value.slice(1));
const currentCategoryId = computed(() => {
	if (activeTab.value === "my") return myCategoryId.value;
	return inspirationCategoryId.value;
});
const tabCards = computed<Record<RecipeTab, CardItem[]>>(() => ({
	my: myRecipes.value.map(toMyCard),
	inspiration: inspirationRecipes.value.map(toInspirationCard)
}));
const cards = computed<CardItem[]>(() => tabCards.value[activeTab.value]);
const showCategoryBar = computed(() => {
	if (activeTab.value === "inspiration") return true;
	return sessionStore.isLoggedIn;
});
const showStickyControls = computed(
	() => showCategoryBar.value || activeTab.value === "inspiration"
);
const keywordText = computed(() => keyword.value.trim());
const activeFilterCount = computed(
	() =>
		Number(activeTab.value === "inspiration" && inspirationSort.value !== "RECOMMENDED") +
		Number(Boolean(activeTab.value === "my" ? myDifficulty.value : inspirationDifficulty.value)) +
		Number(Boolean(activeTab.value === "my" ? myDuration.value : inspirationDuration.value)) +
		Number(Boolean(activeTab.value === "my" ? myInspirationCategoryId.value : ""))
);
const activeFilterBadge = computed(() => (activeFilterCount.value > 9 ? "9+" : String(activeFilterCount.value)));
watch(
	() => sheetVisible.value || showFilters.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);
const emptyStateArt = computed(() => emptyStateIllustration);
const canShowBackToTop = computed(
	() => activeScrollTop.value > backToTopThreshold && !showFilters.value && !sheetVisible.value
);
const loadedMoreOnceMap = ref<Record<RecipeTab, boolean>>({
	my: false,
	inspiration: false
});
const inlineLoading = computed(
	() => loading.value && loadingTab.value === activeTab.value && cards.value.length > 0 && loadSource.value !== "refresh"
);
const inlineLoadingText = computed(() => {
	if (loadSource.value === "search") {
		return ["搜一搜这口想吃的", "帮你翻找菜谱和食材", "锅里翻找中，马上出结果"];
	}
	return loadingTips;
});

function emptyStateTitle(tab: RecipeTab) {
	return tab === "my" ? "先记下第一道拿手菜" : "暂时没找到合适的菜谱";
}

function emptyStateDescription(tab: RecipeTab) {
	return tab === "my"
		? "把常做的家常菜和灵感改编记下来，慢慢建起自己的菜谱集。"
		: "换个分类、关键词或筛选条件试试。";
}
onShareAppMessage(() => ({
  title: APP_NAME,
  path: "/pages/recipe/index"
}));

onShow(() => {
	consumeRecipeTabIntent();
	void loadActiveTab();
});

onHide(() => {
	for (const tab of recipeTabValues) {
		const timer = recipeScrollStopTimers[tab];
		if (timer) clearTimeout(timer);
		recipeScrollStopTimers[tab] = undefined;
	}
	scrollingByTab.value = { my: false, inspiration: false };
	showFilters.value = false;
	closeSheet(true);
});

function handleRecipeScroll(tab: RecipeTab, event: { detail?: { scrollTop?: number } }) {
	scrollTopByTab.value = {
		...scrollTopByTab.value,
		[tab]: Math.max(0, event.detail?.scrollTop ?? 0)
	};
	scrollingByTab.value = { ...scrollingByTab.value, [tab]: true };
	const timer = recipeScrollStopTimers[tab];
	if (timer) clearTimeout(timer);
	recipeScrollStopTimers[tab] = setTimeout(() => {
		scrollingByTab.value = { ...scrollingByTab.value, [tab]: false };
		recipeScrollStopTimers[tab] = undefined;
	}, 300);
}

// 仅在滚动到阈值后显示返回顶部按钮，避免遮挡菜谱首屏内容。
function scrollRecipeToTop() {
	const tab = activeTab.value;
	scrollingByTab.value = { ...scrollingByTab.value, [tab]: true };
	scrollCommandByTab.value = { ...scrollCommandByTab.value, [tab]: scrollTopByTab.value[tab] };
	void nextTick(() => {
		scrollCommandByTab.value = { ...scrollCommandByTab.value, [tab]: 0 };
	});
}

function handleRecipeSwiperChange(event: { detail?: { current?: number } }) {
	const tab = recipeTabValues[event.detail?.current ?? -1];
	if (tab && tab !== activeTab.value) switchTab(tab);
}

watch(
	() => sessionStore.isLoggedIn,
	isLoggedIn => {
		if (isLoggedIn && !loginIntentTab.value && activeTab.value !== "my") {
			if (activeTab.value === "inspiration") {
				resetInspirationFilters();
			}
			activeTab.value = "my";
			keyword.value = "";
			errorText.value = "";
			showFilters.value = false;
		}
		if (!isLoggedIn) {
			closeSheet();
			if (activeTab.value === "my") {
				activeTab.value = "inspiration";
				resetInspirationFilters();
				keyword.value = "";
			}
		}
		void loadActiveTab({ force: true, source: "switch" });
	}
);

watch(
	() => loginModalStore.visible,
	visible => {
		if (!visible && !sessionStore.isLoggedIn) {
			loginIntentTab.value = null;
		}
	}
);

watch(
	keywordText,
	(nextValue, previousValue) => {
		if (!nextValue && previousValue) {
			void loadActiveTab({ force: true, source: "search" });
		}
	}
);
function switchTab(tab: RecipeTab) {
	if (activeTab.value === tab) return;
	const previousTab = activeTab.value;
	activeTab.value = tab;
	errorText.value = "";
	keyword.value = "";
	closeSheet();
	if (previousTab === "inspiration" && tab !== "inspiration") {
		resetInspirationFilters();
		showFilters.value = false;
	} else if (tab !== "inspiration") {
		showFilters.value = false;
	}
	void loadActiveTab({ source: "switch" });
}

function consumeRecipeTabIntent() {
	const intentTab = recipeTabIntentStore.consumePendingTab();
	if (!intentTab) return;
	if (intentTab !== "my" && intentTab !== "inspiration") return;
	if (intentTab === "my" && !sessionStore.isLoggedIn) return;
	if (activeTab.value === intentTab) return;
	if (activeTab.value === "inspiration" && intentTab !== "inspiration") {
		resetInspirationFilters();
	}
	activeTab.value = intentTab;
	keyword.value = "";
	errorText.value = "";
	showFilters.value = false;
}

function changeCategory(categoryId: UUID | "") {
	if (currentCategoryId.value === categoryId) return;
	if (activeTab.value === "my") {
		myCategoryId.value = categoryId;
	} else {
		inspirationCategoryId.value = categoryId;
	}
	void loadActiveTab({ force: true, source: "switch" });
}

function changeSort(value: InspirationSort) {
	if (filterSort.value === value) return;
	filterSort.value = value;
}

function changeDifficulty(value: RecipeDifficulty | "") {
	if (filterDifficulty.value === value) return;
	filterDifficulty.value = value;
}

function changeDuration(value: RecipeDuration | "") {
	if (filterDuration.value === value) return;
	filterDuration.value = value;
}

function changeFilterInspirationCategory(value: UUID | "") {
	filterInspirationCategoryId.value = value;
}

function toggleFilters() {
	if (showFilters.value) {
		closeFilters();
		return;
	}
	syncFilterDraft();
	showFilters.value = true;
}

function searchCurrent() {
	void loadActiveTab({ force: true, source: "search" });
}

function retryLoadActiveTab() {
	void loadActiveTab({ force: true, source: "retry" });
}

function clearKeyword() {
	if (!keyword.value) return;
	keyword.value = "";
}

function closeFilters() {
	showFilters.value = false;
}

function resetInspirationFilters() {
	myDifficulty.value = "";
	myDuration.value = "";
	myInspirationCategoryId.value = "";
	inspirationSort.value = "RECOMMENDED";
	inspirationDifficulty.value = "";
	inspirationDuration.value = "";
	filterSort.value = "RECOMMENDED";
	filterDifficulty.value = "";
	filterDuration.value = "";
}

function syncFilterDraft() {
	if (activeTab.value === "my") {
		filterSort.value = "RECOMMENDED";
		filterDifficulty.value = myDifficulty.value;
		filterDuration.value = myDuration.value;
		filterInspirationCategoryId.value = myInspirationCategoryId.value;
		return;
	}
	filterSort.value = inspirationSort.value;
	filterDifficulty.value = inspirationDifficulty.value;
	filterDuration.value = inspirationDuration.value;
	filterInspirationCategoryId.value = inspirationCategoryId.value;
}

function resetFilters() {
	filterSort.value = "RECOMMENDED";
	filterDifficulty.value = "";
	filterDuration.value = "";
	filterInspirationCategoryId.value = "";
}

function applyFilters() {
	const changed = activeTab.value === "my"
		? filterDifficulty.value !== myDifficulty.value ||
		  filterDuration.value !== myDuration.value ||
		  filterInspirationCategoryId.value !== myInspirationCategoryId.value
		: filterSort.value !== inspirationSort.value ||
		  filterDifficulty.value !== inspirationDifficulty.value ||
		  filterDuration.value !== inspirationDuration.value;
	if (activeTab.value === "my") {
		myDifficulty.value = filterDifficulty.value;
		myDuration.value = filterDuration.value;
		myInspirationCategoryId.value = filterInspirationCategoryId.value;
	} else {
		inspirationSort.value = filterSort.value;
		inspirationDifficulty.value = filterDifficulty.value;
		inspirationDuration.value = filterDuration.value;
	}
	showFilters.value = false;
	if (changed) {
		void loadActiveTab({ force: true, source: "switch" });
	}
}

function getHomeScope(tab: RecipeTab) {
	if (tab === "my") return "home-my" as const;
	return "home-inspiration" as const;
}

function syncTabLoadState(tab: RecipeTab, keywordValue = keywordText.value) {
	loadedVersions.value[tab] = getRecipeViewVersion(getHomeScope(tab));
	loadedKeywords.value[tab] = keywordValue;
}

function shouldLoadTab(tab: RecipeTab, force = false) {
	if (force) return true;
	return (
		loadedVersions.value[tab] !== getRecipeViewVersion(getHomeScope(tab)) ||
		loadedKeywords.value[tab] !== keywordText.value
	);
}

async function loadActiveTab(options: { force?: boolean; source?: LoadSource } = {}) {
	const source = options.source ?? "initial";
	const currentTab = activeTab.value;
	if (loading.value || loadingMore.value) {
		pendingTabLoad = { tab: currentTab, options };
		return false;
	}
	if (!shouldLoadTab(currentTab, options.force)) return false;
	errorText.value = "";
	loadSource.value = source;
	loadingTab.value = currentTab;
	const requestKeyword = keywordText.value;
	let success = false;

	loading.value = true;
	try {
		if (currentTab === "my") {
			if (!sessionStore.isLoggedIn) {
				myCategories.value = [];
				myRecipes.value = [];
				tabPage.value.my = 0;
				tabHasNext.value.my = false;
				tabLoadedOnce.value.my = true;
				syncTabLoadState(currentTab, requestKeyword);
				success = true;
				return success;
			}
			const optionRequests: Promise<unknown>[] = [];
			if (!myCategories.value.length || source === "refresh") optionRequests.push(recipeApi.listCategories());
			if (!inspirationCategories.value.length || source === "refresh") optionRequests.push(recipeApi.listInspirationCategories());
			if (optionRequests.length) {
				const options = await Promise.all(optionRequests);
				let optionIndex = 0;
				if (!myCategories.value.length || source === "refresh") myCategories.value = options[optionIndex++] as RecipeCategorySummary[];
				if (!inspirationCategories.value.length || source === "refresh") inspirationCategories.value = options[optionIndex++] as InspirationCategorySummary[];
			}
			const result = await recipeApi.listMyRecipes({
				page: 1,
				pageSize: pageSizeMap.my,
				keyword: requestKeyword || undefined,
				categoryId: myCategoryId.value || undefined,
				inspirationCategoryId: myInspirationCategoryId.value || undefined,
				difficulty: myDifficulty.value || undefined,
				duration: myDuration.value || undefined
			});
			myRecipes.value = result.items;
			tabPage.value.my = result.page;
			tabHasNext.value.my = result.hasNext;
			loadedMoreOnceMap.value.my = false;
			tabLoadedOnce.value.my = true;
			syncTabLoadState(currentTab, requestKeyword);
			success = true;
			return success;
		}

		if (!inspirationCategories.value.length || source === "refresh") {
			inspirationCategories.value = await recipeApi.listInspirationCategories();
		}
		const result = await recipeApi.listInspirationRecipes({
			page: 1,
			pageSize: pageSizeMap.inspiration,
			keyword: requestKeyword || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined,
			duration: inspirationDuration.value || undefined
		});
		inspirationRecipes.value = result.items;
		tabPage.value.inspiration = result.page;
		tabHasNext.value.inspiration = result.hasNext;
		loadedMoreOnceMap.value.inspiration = false;
		tabLoadedOnce.value.inspiration = true;
		syncTabLoadState(currentTab, requestKeyword);
		success = true;
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			if (activeTab.value === currentTab) {
				activeTab.value = "inspiration";
				loginModalStore.open(null, () => {
					void loadActiveTab({ force: true, source: "retry" });
				});
				errorText.value = "";
			}
		} else {
			if (activeTab.value === currentTab) {
				errorText.value = "菜谱加载失败";
				await uniPlatform.feedback.toast({
					title: error instanceof Error && error.message ? error.message : "菜谱加载失败",
					icon: "none"
				});
			}
		}
	} finally {
		loading.value = false;
		loadingTab.value = null;
		loadSource.value = "idle";
		loadPendingTab();
	}
	return success;
}

function loadPendingTab() {
	if (loading.value || loadingMore.value || !pendingTabLoad) return;
	const pending = pendingTabLoad;
	pendingTabLoad = null;
	if (pending.tab === activeTab.value) void loadActiveTab(pending.options);
}

async function loadMoreActiveTab(tab: RecipeTab) {
	const currentTab = tab;
	if (currentTab !== activeTab.value) return;
	if (loading.value || loadingMore.value || !tabHasNext.value[currentTab]) return;

	loadingMore.value = true;
	loadingMoreTab.value = currentTab;
	errorText.value = "";
	const requestKeyword = keywordText.value;

	try {
		if (currentTab === "my") {
			if (!sessionStore.isLoggedIn) return;
			const result = await recipeApi.listMyRecipes({
					page: tabPage.value.my + 1,
					pageSize: pageSizeMap.my,
					keyword: requestKeyword || undefined,
					categoryId: myCategoryId.value || undefined,
					inspirationCategoryId: myInspirationCategoryId.value || undefined,
					difficulty: myDifficulty.value || undefined,
					duration: myDuration.value || undefined
				});
			myRecipes.value = [...myRecipes.value, ...result.items];
			tabPage.value.my = result.page;
			tabHasNext.value.my = result.hasNext;
			if (result.items.length > 0) {
				loadedMoreOnceMap.value.my = true;
			}
			syncTabLoadState(currentTab, requestKeyword);
			return;
		}

			const result = await recipeApi.listInspirationRecipes({
			page: tabPage.value.inspiration + 1,
			pageSize: pageSizeMap.inspiration,
			keyword: requestKeyword || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined,
			duration: inspirationDuration.value || undefined
		});
		inspirationRecipes.value = [...inspirationRecipes.value, ...result.items];
		tabPage.value.inspiration = result.page;
		tabHasNext.value.inspiration = result.hasNext;
		if (result.items.length > 0) {
			loadedMoreOnceMap.value.inspiration = true;
		}
		syncTabLoadState(currentTab, requestKeyword);
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			if (activeTab.value === currentTab) {
				activeTab.value = "inspiration";
				loginModalStore.open(null, () => {
					void loadActiveTab({ force: true, source: "retry" });
				});
				errorText.value = "";
			}
		} else {
			if (activeTab.value === currentTab) {
				errorText.value = "加载更多失败";
				await uniPlatform.feedback.toast({
					title: error instanceof Error && error.message ? error.message : "加载更多失败",
					icon: "none"
				});
			}
		}
	} finally {
		loadingMore.value = false;
		loadingMoreTab.value = null;
		loadPendingTab();
	}
}

async function handleRefresherRefresh(tab: RecipeTab) {
	if (tab !== activeTab.value) {
		onRefresherRestore();
		return;
	}
	const shouldRefresh = onRefresherRefresh();
	if (!shouldRefresh) {
		onRefresherRestore();
		return;
	}

	try {
		const success = await loadActiveTab({ force: true, source: "refresh" });
		if (success) {
			await onRefreshComplete();
		}
	} finally {
		onRefresherRestore();
	}
}

function openCard(item: CardItem) {
		void uniPlatform.navigation.navigateTo(
			`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.id))}&kind=${item.kind}`
		);
}

function openManage() {
	closeSheet();
	void uniPlatform.navigation.navigateTo("/pages_recipe/list/index");
}

function handleFab() {
	openAddSheet();
}

function openAddSheet() {
	if (sheetMode.value === "my" && sheetVisible.value) return;
	sheetMode.value = "my";
	sheetVisible.value = false;
	void nextTick(() => {
		sheetVisible.value = true;
	});
}

function closeSheet(immediate = false) {
	if (!sheetMode.value) return;
	sheetVisible.value = false;
	if (immediate) {
		sheetMode.value = "";
	}
}

function handleSheetAfterClose() {
	sheetMode.value = "";
}

function handleEmptyClick() {
	if (!sessionStore.isLoggedIn) {
		loginIntentTab.value = activeTab.value;
		loginModalStore.open(null, () => {
			const intentTab = loginIntentTab.value;
			loginIntentTab.value = null;
			if (intentTab && intentTab !== "inspiration") {
				openAddSheet();
			}
			void loadActiveTab({ force: true, source: "switch" });
		});
		return;
	}

	if (activeTab.value === "inspiration") {
		return;
	}

	openAddSheet();
}

function openRecipeEditor() {
	closeSheet(true);
	void uniPlatform.navigation.navigateTo("/pages_recipe/edit/index");
}

function goToInspiration() {
	closeSheet();
	activeTab.value = "inspiration";
	errorText.value = "";
	showFilters.value = false;
	void loadActiveTab({ source: "switch" });
}

function toMyCard(item: MyRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		contentVersionId: null,
		keywords: item.keywords,
		estimatedCalories: item.estimatedCalories,
		caloriesText: formatCardCalories(item.estimatedCalories),
		subline: "",
		kind: "my",
		saveId: null,
		isSavedToPrivate: false
	};
}

function toInspirationCard(item: InspirationRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		contentVersionId: item.contentVersionId,
		keywords: item.keywords,
		estimatedCalories: item.estimatedCalories,
		caloriesText: formatCardCalories(item.estimatedCalories),
		subline: "",
		kind: "inspiration",
		saveId: item.saveId,
		isSavedToPrivate: item.isSavedToPrivate
	};
}

async function togglePrivateSave(item: CardItem) {
	if (item.kind !== "inspiration" || savingRecipeId.value || !item.contentVersionId) return;
	if (!sessionStore.isLoggedIn) {
		loginModalStore.open(null, () => void togglePrivateSave(item));
		return;
	}
	savingRecipeId.value = item.id;
	try {
		const result = item.isSavedToPrivate && item.saveId
			? await recipeApi.removeSavedInspiration(item.saveId, createOperationId())
			: await recipeApi.saveInspirationToPrivate({
				operationId: createOperationId(),
				sourceRecipeId: item.id,
				sourceVersionId: item.contentVersionId
			});
		inspirationRecipes.value = inspirationRecipes.value.map(recipe => recipe.id === item.id
			? { ...recipe, saveId: result.isSavedToPrivate ? result.saveId : null, isSavedToPrivate: result.isSavedToPrivate, collectCount: result.collectCount }
			: recipe);
		markRecipeHomeDirty(["my"]);
		await uniPlatform.feedback.toast({ title: result.isSavedToPrivate ? "已收藏到私房菜" : "已从私房菜移除", icon: "success" });
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			loginModalStore.open(null, () => void togglePrivateSave(item));
		} else {
			await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "收藏操作失败", icon: "none" });
		}
	} finally {
		savingRecipeId.value = null;
	}
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
	await sessionStore.setSession(snapshot);
	if (activeTab.value !== "my") {
		activeTab.value = "my";
	}
	keyword.value = "";
	errorText.value = "";
	showFilters.value = false;
	await loadActiveTab({ force: true, source: "switch" });
}

function automatorReadThemeState() {
	return {
		themeMode: themeMode.value,
		effectiveSkin: effectiveSkin.value,
		effectivePalette: effectivePalette.value,
		canSwitchPalette: canSwitchPalette.value,
		currentThemeText: currentThemeText.value,
		themePageStyle: themePageStyle.value,
		colorPage: themeVars.value["--color-page"] ?? ""
	};
}

async function automatorResetThemeSettings() {
	await settingsStore.clearSettings();
	return automatorReadThemeState();
}

async function automatorApplyThemeSettings(snapshot: {
	themeMode?: ThemeMode;
	themeSkin?: ThemeSkin;
	themePalette?: ThemePalette;
}) {
	await settingsStore.applyThemeSettings({ ...settingsStore.readCurrentThemeSettings(), ...snapshot });
	return automatorReadThemeState();
}

defineExpose({
	automatorApplySession,
	automatorReadThemeState,
	automatorResetThemeSettings,
	automatorApplyThemeSettings
});

</script>

<style scoped lang="scss">
.recipe-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--color-page);
}

.recipe-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  width: 100%;
  min-width: 0;
}

.nav-tabs {
  display: flex;
  flex: 1;
  gap: 52rpx;
  align-items: flex-start;
  min-width: 0;
}

.nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 46rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.nav-tabs__item--active {
  color: var(--color-text);
}

.recipe-head {
  position: relative;
  z-index: 901;
  box-sizing: border-box;
  padding: 10rpx var(--space-page) 0;
}

.search-row {
  flex: none;
  margin-top: 12rpx;
}

.search-row__inner {
  min-width: 0;
}

.sticky-wrap {
  position: relative;
  z-index: 2;
  flex: none;
  margin-top: 20rpx;
  padding-bottom: 16rpx;
}

.recipe-scroll {
	display: block;
	width: 100%;
	height: 100%;
	min-height: 0;
}

.recipe-scroll-wrap {
  display: flex;
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 var(--space-page);
}

.recipe-swiper {
	flex: 1;
	width: 100%;
	height: 100%;
	min-height: 0;
}

.recipe-swiper-item {
	height: 100%;
	min-height: 0;
}

.recipe-back-top {
  position: absolute;
  right: 28rpx;
  bottom: calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom) + 24rpx);
  z-index: 902;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  opacity: 0;
  pointer-events: none;
  transform: translateX(calc(50% + 28rpx));
  transition:
    transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1),
    opacity 360ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

.recipe-back-top--visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.recipe-back-top--scrolling {
  opacity: 0.35;
}

.recipe-back-top--hover {
  opacity: 0.85;
}

.recipe-back-top__icon {
  color: inherit;
  font-size: 50rpx;
  line-height: 1;
}

.filter-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: var(--color-surface-mask-medium);
}

.sticky-bar {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 56rpx;
  z-index: 0;
}

.category-fixed {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  padding-right: 16rpx;
  background: var(--color-page);
}

.category-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.category-row,
.filter-group__chips {
  display: flex;
  gap: 16rpx;
}

.category-row {
  width: max-content;
  padding-right: 24rpx;
}

.sticky-bar--inspiration .category-row {
  padding-right: 184rpx;
}

.category-chip,
.filter-chip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.category-chip--active,
.filter-chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.category-chip__name,
.filter-chip {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.category-chip--active .category-chip__name,
.filter-chip--active {
  color: var(--color-tag-primary-text);
}

.filter-trigger-wrap {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  padding-left: 28rpx;
  background: var(--page-edge-fade-bg);
}

.filter-trigger {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8rpx;
  min-width: 88rpx;
  height: 56rpx;
  padding: 0 12rpx 0 6rpx;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.filter-trigger--active {
  color: var(--color-support-action);
}

.filter-trigger__text {
  line-height: 1;
}

.filter-trigger__icon {
  color: inherit;
  font-size: 28rpx;
  line-height: 1;
}

.filter-trigger__badge {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border: 4rpx solid var(--color-page);
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  box-sizing: border-box;
  color: var(--color-tag-primary-text);
  font-size: 20rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.notice,
.login-card {
  margin-top: var(--space-md);
}

.filter-drawer {
  position: absolute;
  top: calc(100% + 10rpx);
  right: 0;
  z-index: 2;
  width: 600rpx;
  max-width: calc(100% - 40rpx);
  padding: var(--space-md);
  border-radius: var(--radius-xs);
  background: var(--material-panel-bg);
  box-shadow: var(--material-panel-shadow);
  -webkit-backdrop-filter: var(--material-panel-filter);
  backdrop-filter: var(--material-panel-filter);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-8rpx) scale(0.98);
  transform-origin: top right;
  transition: transform 180ms ease, opacity 180ms ease;
}

.filter-drawer--visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}

.filter-group + .filter-group {
  margin-top: var(--space-md);
}

.filter-group__title {
  display: block;
  margin-bottom: var(--space-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.filter-group__chips {
  flex-wrap: wrap;
}

.filter-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.filter-actions__button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.filter-actions__button--ghost {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.filter-actions__button--primary {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.notice,
.recipe-card {
  padding: var(--space-md);
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice {
  color: var(--color-text-secondary);
}

.list-shell {
  padding-bottom: calc(24rpx + var(--tabbar-shell-height) + env(safe-area-inset-bottom));
}

.recipe-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 30rpx;
  padding-bottom: calc(24rpx + var(--tabbar-shell-height) + env(safe-area-inset-bottom));
}

.list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 30rpx;
}

.recipe-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  border: none;
}

.recipe-card--hover,
.manage-fab--hover {
  opacity: 0.86;
}

.recipe-card--skeleton {
  pointer-events: none;
}

.recipe-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  background: var(--page-cover-fresh-bg);
}

.recipe-card__cover-image {
  width: 100%;
  height: 100%;
}

.recipe-card__cover-image {
  display: block;
}

.recipe-card__cover--skeleton {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.recipe-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx 20rpx 24rpx;
}

.recipe-card__save {
	align-self: flex-start;
	margin: 14rpx 0 0;
	padding: 8rpx 16rpx;
	border: 1rpx solid var(--color-border);
	border-radius: 999rpx;
	background: transparent;
	color: var(--color-text-secondary);
	font-size: 22rpx;
	line-height: 1.4;
}

.recipe-card__save::after {
	border: 0;
}

.recipe-card__save--active {
	border-color: var(--color-border-active);
	color: var(--color-support-action);
}

.recipe-card__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-width: 0;
}

.recipe-card__title,
.recipe-card__meta,
.recipe-card__calories,
.recipe-card__sub {
  display: block;
}

.recipe-card__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.45;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.recipe-card__meta,
.recipe-card__sub {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-card__meta {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
}

.recipe-card__skeleton-meta {
  display: flex;
  gap: 8rpx;
}

.recipe-card__meta-tag {
  flex: 0 0 auto;
  max-width: 180rpx;
  overflow: hidden;
  padding: 6rpx 12rpx;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 20rpx;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recipe-card__calories {
  flex: 0 0 auto;
  margin-left: auto;
  max-width: 40%;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manage-fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
}

.manage-fab__icon {
  color: var(--color-text-secondary);
  font-size: 50rpx;
  line-height: 1;
  flex: 0 0 auto;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: var(--color-surface-mask-medium);
}

.action-card + .action-card {
  margin-top: 18rpx;
}

.action-card--hover {
  opacity: 0.88;
}

.action-card__icon {
  display: flex;
  flex: 0 0 92rpx;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.action-card__icon-text {
  color: var(--color-icon-accent);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
}

.action-card__main {
  flex: 1;
  min-width: 0;
}

.action-card__name,
.action-card__desc {
  display: block;
}

.action-card__name {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-bold);
}

.action-card__desc {
  margin-top: 10rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: var(--line-height-normal);
}

.action-card__arrow {
  color: var(--color-text-tertiary);
  font-size: 56rpx;
  line-height: 1;
}
</style>
