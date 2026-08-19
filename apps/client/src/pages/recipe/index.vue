<template>
  <page-meta :page-style="pageStyle" />
  <Layout current-tab="recipe" :show-left="false" navbar-layout="custom-left" full-screen>
    <template #navbar-left>
      <view class="nav-tabs">
        <view
          v-for="item in tabs"
          :key="item.value"
          class="nav-tabs__item font-medium"
          :class="{ 'nav-tabs__item--active': activeTab === item.value }"
          @click="switchTab(item.value)"
        >
          {{ item.label }}
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
              <text class="filter-group__title">系统分类</text>
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

        <scroll-view
          scroll-y
          class="recipe-scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          :lower-threshold="120"
          @scroll="handleListScroll"
          @scrolltolower="loadMoreActiveTab"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view v-if="errorText" class="notice" @click="retryLoadActiveTab">{{ errorText }}</view>
          <view v-else-if="loading && !cards.length" class="notice">加载中...</view>

          <Empty
            v-else-if="showRecipeEmpty"
            :art="emptyStateArt"
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            :clickable="emptyStateClickable"
            @click="handleEmptyClick"
          />

          <view v-else class="list">
            <view
              v-for="item in cards"
              :key="item.id"
              class="recipe-card"
              hover-class="recipe-card--hover"
              hover-stay-time="100"
              @click="openCard(item)"
            >
              <view class="recipe-card__cover">
                <text v-if="item.coverTag" class="recipe-card__cover-tag">{{ item.coverTag }}</text>
                <image
                  v-if="item.coverImageUrl"
                  class="recipe-card__cover-image"
                  :src="item.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="recipe-card__cover-fallback">
                  <text class="recipe-card__cover-text font-black">封面图</text>
                </view>
              </view>

              <view class="recipe-card__body">
                <text class="recipe-card__title">{{ item.title }}</text>
                <view class="recipe-card__info">
                  <view class="recipe-card__meta">
                    <text class="cookfont icon-time recipe-card__meta-icon" />
                    <text class="recipe-card__meta-text">{{ item.meta }}</text>
                  </view>
                  <view v-if="item.tag" class="recipe-card__tag" :class="{ 'recipe-card__tag--metric': item.kind === 'inspiration' }">
                    <text v-if="item.kind === 'inspiration'" class="cookfont icon-collect recipe-card__tag-icon" />
                    <text>{{ item.tag }}</text>
                  </view>
                </view>
                <text v-if="item.subline" class="recipe-card__sub">{{ item.subline }}</text>
              </view>
            </view>

            <view v-if="showFooter" class="list-footer">{{ footerText }}</view>
          </view>
        </scroll-view>
      </view>

      <view
        v-if="sessionStore.isLoggedIn && activeTab !== 'inspiration'"
        class="manage-fab"
        :class="{ 'manage-fab--hidden': fabHidden }"
        hover-class="manage-fab--hover"
        hover-stay-time="100"
        @click="handleFab"
      >
        <image class="manage-fab__icon" :src="manageIcon" mode="aspectFit" />
        <text class="manage-fab__text">{{ fabText }}</text>
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
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { onHide, onShow } from "@dcloudio/uni-app";
import emptyStateIllustration from "@/assets/recipe-page/empty-state.svg";
import manageIcon from "@/assets/recipe-page/manage.svg";
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
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { getRecipeViewVersion } from "@/pages/recipe/utils/recipe-view-sync";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { difficultyOptions, durationOptions } from "@/utils/recipe-meta";

type RecipeTab = "my" | "inspiration";
type SheetMode = "" | "my";
type LoadSource = "idle" | "initial" | "search" | "refresh" | "switch" | "retry";
const RECIPE_HOME_INTENT_STORAGE_KEY = "recipe-home-intent-tab";

interface CategoryItem {
	id: UUID | "";
	name: string;
}

interface CardItem {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	coverTag: string;
	meta: string;
	tag: string;
	subline: string;
	kind: "my" | "inspiration";
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

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();

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
const sortItems = [
	{ value: "RECOMMENDED" as const, label: "推荐" },
	{ value: "LATEST" as const, label: "最新" }
];
const difficultyItems = [{ value: "" as const, label: "全部" }, ...difficultyOptions];
const durationItems = [{ value: "" as const, label: "全部" }, ...durationOptions];

const activeTab = ref<RecipeTab>(sessionStore.isLoggedIn ? "my" : "inspiration");
const keyword = ref("");
const showFilters = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const fabHidden = ref(false);
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

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
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
const cards = computed<CardItem[]>(() => {
	if (activeTab.value === "my") return myRecipes.value.map(toMyCard);
	return inspirationRecipes.value.map(toInspirationCard);
});
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
		Number(Boolean(activeTab.value === "my" ? myInspirationCategoryId.value : inspirationCategoryId.value))
);
const activeFilterBadge = computed(() => (activeFilterCount.value > 9 ? "9+" : String(activeFilterCount.value)));
watch(
	() => sheetVisible.value || showFilters.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);
const showRecipeEmpty = computed(
	() =>
		(activeTab.value === "my" && !cards.value.length) ||
		(activeTab.value === "inspiration" && !cards.value.length)
);
const emptyStateClickable = computed(() => activeTab.value !== "inspiration");
const emptyStateTitle = computed(() => {
	if (activeTab.value === "my") return "添加你的第一道私房菜";
	return "暂时没找到合适的菜谱";
});
const emptyStateDescription = computed(() =>
	activeTab.value === "my"
		? "记录家常拿手菜、灵感改编和做法草稿，点一下就开始添加。"
			: "换个分类、关键词或筛选条件试试。"
);
const emptyStateArt = computed(() => emptyStateIllustration);
const fabText = computed(() => {
	return "添加";
});
const currentHasNext = computed(() => tabHasNext.value[activeTab.value]);
const footerText = computed(() => {
	if (loadingMore.value) return "加载更多中...";
	return currentHasNext.value ? "上滑继续加载" : "没有更多了";
});
const showFooter = computed(() => cards.value.length > 0 && !errorText.value);
const inlineLoading = computed(() => loading.value && cards.value.length > 0 && loadSource.value !== "refresh");
const inlineLoadingText = computed(() => {
	if (loadSource.value === "search") {
		return ["搜一搜这口想吃的", "帮你翻找菜谱和食材", "锅里翻找中，马上出结果"];
	}
	return loadingTips;
});
onShow(() => {
	consumeRecipeTabIntent();
	void loadActiveTab();
});

onHide(() => {
	showFilters.value = false;
	closeSheet(true);
});

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
function handleListScroll() {
	if (activeTab.value === "inspiration") return;
	fabHidden.value = true;
	if (scrollTimer) clearTimeout(scrollTimer);
	scrollTimer = setTimeout(() => {
		fabHidden.value = false;
		scrollTimer = null;
	}, 180);
}

onUnmounted(() => {
	if (scrollTimer) clearTimeout(scrollTimer);
});

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
	const intentTab = uniPlatform.storage.getSync<RecipeTab | null>(RECIPE_HOME_INTENT_STORAGE_KEY);
	if (!intentTab) return;
	uniPlatform.storage.removeSync(RECIPE_HOME_INTENT_STORAGE_KEY);
	if (intentTab !== "my" && intentTab !== "inspiration") return;
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

function syncTabLoadState(tab: RecipeTab) {
	loadedVersions.value[tab] = getRecipeViewVersion(getHomeScope(tab));
	loadedKeywords.value[tab] = keywordText.value;
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
	if (loading.value || loadingMore.value || !shouldLoadTab(currentTab, options.force)) return false;
	errorText.value = "";
	loadSource.value = source;
	let success = false;

	loading.value = true;
	try {
		if (currentTab === "my") {
			if (!sessionStore.isLoggedIn) {
				myCategories.value = [];
				myRecipes.value = [];
				tabPage.value.my = 0;
				tabHasNext.value.my = false;
				syncTabLoadState(currentTab);
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
				keyword: keywordText.value || undefined,
				categoryId: myCategoryId.value || undefined,
				inspirationCategoryId: myInspirationCategoryId.value || undefined,
				difficulty: myDifficulty.value || undefined,
				duration: myDuration.value || undefined
			});
			myRecipes.value = result.items;
			tabPage.value.my = result.page;
			tabHasNext.value.my = result.hasNext;
			syncTabLoadState(currentTab);
			success = true;
			return success;
		}

		if (!inspirationCategories.value.length || source === "refresh") {
			inspirationCategories.value = await recipeApi.listInspirationCategories();
		}
		const result = await recipeApi.listInspirationRecipes({
			page: 1,
			pageSize: pageSizeMap.inspiration,
			keyword: keywordText.value || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined,
			duration: inspirationDuration.value || undefined
		});
		inspirationRecipes.value = result.items;
		tabPage.value.inspiration = result.page;
		tabHasNext.value.inspiration = result.hasNext;
		syncTabLoadState(currentTab);
		success = true;
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "菜谱加载失败";
	} finally {
		loading.value = false;
		loadSource.value = "idle";
	}
	return success;
}

async function loadMoreActiveTab() {
	const currentTab = activeTab.value;
	if (loading.value || loadingMore.value || !tabHasNext.value[currentTab]) return;

	loadingMore.value = true;
	errorText.value = "";

	try {
		if (currentTab === "my") {
			if (!sessionStore.isLoggedIn) return;
			const result = await recipeApi.listMyRecipes({
					page: tabPage.value.my + 1,
					pageSize: pageSizeMap.my,
					keyword: keywordText.value || undefined,
					categoryId: myCategoryId.value || undefined,
					inspirationCategoryId: myInspirationCategoryId.value || undefined,
					difficulty: myDifficulty.value || undefined,
					duration: myDuration.value || undefined
				});
			myRecipes.value = [...myRecipes.value, ...result.items];
			tabPage.value.my = result.page;
			tabHasNext.value.my = result.hasNext;
			syncTabLoadState(currentTab);
			return;
		}

			const result = await recipeApi.listInspirationRecipes({
			page: tabPage.value.inspiration + 1,
			pageSize: pageSizeMap.inspiration,
			keyword: keywordText.value || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined,
			duration: inspirationDuration.value || undefined
		});
		inspirationRecipes.value = [...inspirationRecipes.value, ...result.items];
		tabPage.value.inspiration = result.page;
		tabHasNext.value.inspiration = result.hasNext;
		syncTabLoadState(currentTab);
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "加载更多失败";
	} finally {
		loadingMore.value = false;
	}
}

async function handleRefresherRefresh() {
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

function formatMetricCount(value: number) {
	if (value <= 999) return "";
	if (value < 10000) return `${Math.floor(value / 100) / 10}`.replace(/\.0$/, "") + "k";
	return `${Math.floor(value / 1000) / 10}`.replace(/\.0$/, "") + "w";
}

function toMyCard(item: MyRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		coverTag: item.category.name,
		meta: item.durationText || "未设时长",
		tag: "",
		subline: "",
		kind: "my"
	};
}

function toInspirationCard(item: InspirationRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		coverTag: item.category.name,
		meta: item.durationText || "未设时长",
		tag: formatMetricCount(item.collectCount),
		subline: "",
		kind: "inspiration"
	};
}

</script>

<style scoped lang="scss">
.recipe-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.nav-tabs {
  display: flex;
  gap: 52rpx;
  align-items: flex-end;
  min-width: 0;
  padding-top: 6rpx;
}

.nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 40rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.nav-tabs__item--active {
  color: var(--color-text);
}

.nav-tabs__item--active::after {
  content: "";
  position: absolute;
  right: -8rpx;
  bottom: 2rpx;
  left: -8rpx;
  z-index: -1;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--theme-primary);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.recipe-head {
  position: relative;
  z-index: 25;
  box-sizing: border-box;
  padding: 10rpx var(--space-page) 0;
  background: var(--color-page);
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
  background: var(--color-page);
}

.recipe-scroll {
  flex: 1;
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
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
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
  color: var(--color-primary-active);
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
  background: linear-gradient(90deg, var(--color-surface-mask-weak), var(--color-page) 28%);
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
  color: var(--color-primary-active);
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
  background: var(--color-primary-soft);
  box-sizing: border-box;
  color: var(--color-primary-foreground);
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
  width: 500rpx;
  max-width: calc(100% - 40rpx);
  padding: var(--space-md);
  border-radius: var(--radius-xs);
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--color-page) 100%);
  box-shadow: var(--shadow-floating);
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.notice,
.recipe-card {
  padding: var(--space-md);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
}

.notice {
  color: var(--color-text-secondary);
}

.list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  padding-bottom: calc(24rpx + var(--tabbar-shell-height) + env(safe-area-inset-bottom));
}

.list-footer {
  grid-column: 1 / -1;
  padding: 12rpx 0 8rpx;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.5;
  text-align: center;
}

.recipe-card {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  border: none;
  box-shadow: 0 6rpx 14rpx rgba(57, 44, 31, 0.035);
}

.recipe-card--hover,
.manage-fab--hover {
  opacity: 0.86;
}

.recipe-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: linear-gradient(180deg, rgba(255, 252, 247, 0.94) 0%, rgba(245, 238, 227, 0.96) 100%);
}

.recipe-card__cover-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 1;
  max-width: calc(100% - 32rpx);
  padding: 8rpx 14rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-mask-strong);
  color: var(--color-text-secondary);
  font-size: 20rpx;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recipe-card__cover-image,
.recipe-card__cover-fallback {
  width: 100%;
  height: 100%;
}

.recipe-card__cover-image {
  display: block;
}

.recipe-card__cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-card__cover-text {
  color: var(--color-text-secondary);
  opacity: 0.54;
  font-size: 52rpx;
  font-weight: var(--font-weight-heavy);
}

.recipe-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx 20rpx 24rpx;
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
.recipe-card__tag,
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

.recipe-card__meta-icon {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1;
}

.recipe-card__meta-text {
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-card__tag {
  display: flex;
  align-items: center;
  gap: 6rpx;
  flex: 0 0 auto;
  max-width: 40%;
  overflow: hidden;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recipe-card__tag--metric {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-card__tag-icon {
  color: inherit;
  font-size: 20rpx;
  line-height: 1;
}

.manage-fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(148rpx + env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  box-shadow: var(--shadow-floating);
  transform: translateX(0);
  transition: transform 180ms ease, opacity 180ms ease;
}

.manage-fab__icon {
  width: 32rpx;
  height: 32rpx;
  flex: 0 0 auto;
}

.manage-fab__text {
  line-height: 1;
}

.manage-fab--hidden {
  opacity: 0;
  transform: translateX(140%);
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
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.action-card__icon-text {
  color: var(--entry-outline);
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
