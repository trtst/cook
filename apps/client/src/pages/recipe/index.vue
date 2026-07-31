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
      <view class="search-row">
        <RecipeSearchBar
          v-model="keyword"
          @confirm="searchCurrent"
          @clear="clearKeyword"
        />
      </view>

      <view v-if="showStickyControls" class="sticky-wrap" :style="stickyStyle">
        <view v-if="showFilters" class="filter-overlay" @click="closeFilters" />
        <view v-if="showCategoryBar" class="sticky-bar" :class="{ 'sticky-bar--inspiration': activeTab === 'inspiration' }">
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

          <view v-if="activeTab === 'inspiration'" class="filter-trigger-wrap">
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
          v-if="activeTab === 'inspiration'"
          class="filter-drawer"
          :class="{ 'filter-drawer--visible': showFilters }"
        >
          <view class="filter-group">
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

          <view class="filter-actions">
            <view class="filter-actions__button filter-actions__button--ghost" @click="resetFilters">重置</view>
            <view class="filter-actions__button filter-actions__button--primary" @click="applyFilters">确定</view>
          </view>
        </view>
      </view>

      <template>
        <view v-if="errorText" class="notice" @click="loadActiveTab">{{ errorText }}</view>
        <view v-else-if="loading" class="notice">加载中...</view>

        <RecipeEmptyState
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
        </view>
      </template>

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

      <SheetShell v-if="sheetMode" :visible="sheetVisible" @close="closeSheet">
          <view class="sheet__header">
            <text class="sheet__title">{{ sheetTitle }}</text>
            <text class="cookfont icon-close sheet__close" @click="closeSheet" />
          </view>

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
              <text class="action-card__name">从广场挑菜</text>
              <text class="action-card__desc">切到灵感页挑选并收藏菜谱</text>
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
import { onPageScroll, onShow } from "@dcloudio/uni-app";
import emptyCollectionIllustration from "@/assets/recipe-page/empty-collection.svg";
import emptyStateIllustration from "@/assets/recipe-page/empty-state.svg";
import manageIcon from "@/assets/recipe-page/manage.svg";
import {
	recipeApi,
	type CollectionSceneSummary,
	type CollectedRecipeSummary,
	type InspirationCategorySummary,
	type InspirationRecipeSummary,
	type InspirationSort,
	type MyRecipeSummary,
	type RecipeCategorySummary,
	type RecipeSceneSummary,
	type RecipeDifficulty,
	type RecipeDuration
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import Layout from "@/components/Layout/Layout.vue";
import RecipeEmptyState from "@/components/Recipe/RecipeEmptyState.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";

type RecipeTab = "my" | "inspiration" | "collection";
type SheetMode = "" | "my";

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
	kind: "my" | "inspiration" | "collection";
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
const SHEET_ANIMATION_MS = 260;

const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const { navBarTotalHeight } = useSystemInfo();

const tabs = [
	{ value: "my" as const, label: "我的" },
	{ value: "inspiration" as const, label: "灵感" },
	{ value: "collection" as const, label: "合集" }
];
const sortItems = [
	{ value: "RECOMMENDED" as const, label: "推荐" },
	{ value: "LATEST" as const, label: "最新" }
];
const difficultyItems = [
	{ value: "" as const, label: "全部" },
	{ value: "BEGINNER" as const, label: "新手友好" },
	{ value: "EASY" as const, label: "轻松上手" },
	{ value: "SKILLED" as const, label: "需要经验" },
	{ value: "CHALLENGING" as const, label: "进阶挑战" }
];
const durationItems = [
	{ value: "" as const, label: "全部" },
	{ value: "WITHIN_15" as const, label: "15分钟内" },
	{ value: "BETWEEN_15_30" as const, label: "15~30分钟" },
	{ value: "BETWEEN_30_60" as const, label: "30~60分钟" },
	{ value: "OVER_60" as const, label: "1小时以上" }
];

const activeTab = ref<RecipeTab>(sessionStore.isLoggedIn ? "my" : "inspiration");
const keyword = ref("");
const showFilters = ref(false);
const loading = ref(false);
const errorText = ref("");
const fabHidden = ref(false);
const myCategories = ref<RecipeCategorySummary[]>([]);
const inspirationCategories = ref<InspirationCategorySummary[]>([]);
const collectionScenes = ref<CollectionSceneSummary[]>([]);
const collectionRecipes = ref<CollectedRecipeSummary[]>([]);
const myCategoryId = ref<UUID | "">("");
const inspirationCategoryId = ref<UUID | "">("");
const collectionSceneId = ref<UUID | "">("");
const inspirationSort = ref<InspirationSort>("RECOMMENDED");
const inspirationDifficulty = ref<RecipeDifficulty | "">("");
const inspirationDuration = ref<RecipeDuration | "">("");
const filterSort = ref<InspirationSort>("RECOMMENDED");
const filterDifficulty = ref<RecipeDifficulty | "">("");
const filterDuration = ref<RecipeDuration | "">("");
const myRecipes = ref<MyRecipeSummary[]>([]);
const inspirationRecipes = ref<InspirationRecipeSummary[]>([]);
const loginIntentTab = ref<RecipeTab | null>(null);
const sheetMode = ref<SheetMode>("");
const sheetVisible = ref(false);
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recipe-page-sheet"));

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let sheetTimer: ReturnType<typeof setTimeout> | null = null;

const stickyStyle = computed(() => ({
	top: `${navBarTotalHeight.value}px`
}));
const categoryItems = computed<CategoryItem[]>(() => {
	if (activeTab.value === "my") {
		return [{ id: "", name: "全部" }, ...myCategories.value.map(item => ({ id: item.id, name: item.name }))];
	}
	if (activeTab.value === "inspiration") {
		return [{ id: "", name: "全部" }, ...inspirationCategories.value.map(item => ({ id: item.id, name: item.name }))];
	}
	return [{ id: "", name: "全部" }, ...collectionScenes.value.map(item => ({ id: item.id, name: item.name }))];
});
const firstCategoryItem = computed<CategoryItem>(() => categoryItems.value[0] || { id: "", name: "全部" });
const scrollCategoryItems = computed<CategoryItem[]>(() => categoryItems.value.slice(1));
const currentCategoryId = computed(() => {
	if (activeTab.value === "my") return myCategoryId.value;
	if (activeTab.value === "inspiration") return inspirationCategoryId.value;
	return collectionSceneId.value;
});
const selectedCollection = computed(() => {
	if (!collectionScenes.value.length) return null;
	return collectionScenes.value.find(item => item.id === collectionSceneId.value) || collectionScenes.value[0];
});
const cards = computed<CardItem[]>(() => {
	if (activeTab.value === "my") return myRecipes.value.map(toMyCard);
	if (activeTab.value === "inspiration") return inspirationRecipes.value.map(toInspirationCard);
	return collectionRecipes.value.map(toCollectionCard);
});
const collectionNeedsCreate = computed(
	() => activeTab.value === "collection" && !collectionScenes.value.length && !collectionSceneId.value
);
const showCategoryBar = computed(() => {
	if (activeTab.value === "inspiration") return true;
	if (!sessionStore.isLoggedIn) return false;
	if (activeTab.value === "my") return myCategories.value.length > 0;
	return collectionScenes.value.length > 0;
});
const showStickyControls = computed(
	() => showCategoryBar.value || activeTab.value === "inspiration"
);
const keywordText = computed(() => keyword.value.trim());
const activeFilterCount = computed(
	() =>
		Number(inspirationSort.value !== "RECOMMENDED") +
		Number(Boolean(inspirationDifficulty.value)) +
		Number(Boolean(inspirationDuration.value))
);
const activeFilterBadge = computed(() => (activeFilterCount.value > 9 ? "9+" : String(activeFilterCount.value)));
watch(
	() => Boolean(sheetMode.value) || showFilters.value,
	(visible) => {
		setPageLocked(visible);
	},
	{ immediate: true }
);
const showRecipeEmpty = computed(
	() =>
		(activeTab.value === "my" && !cards.value.length) ||
		(activeTab.value === "inspiration" && !cards.value.length) ||
		(activeTab.value === "collection" && !cards.value.length)
);
const emptyStateClickable = computed(() => activeTab.value !== "inspiration");
const emptyStateTitle = computed(() => {
	if (activeTab.value === "my") return "添加你的第一道菜谱";
	if (activeTab.value === "inspiration") return "暂时没找到合适的菜谱";
	return collectionNeedsCreate.value ? "还没有合集菜谱" : `${selectedCollection.value?.name || "这个合集"}还没有菜谱`;
});
const emptyStateDescription = computed(() =>
	activeTab.value === "my"
		? "记录家常拿手菜、灵感改编和做法草稿，点一下就开始添加。"
		: activeTab.value === "inspiration"
			? "换个分类、关键词或筛选条件试试。"
		: collectionNeedsCreate.value
			? "可以先手动添加菜谱，或去灵感页挑菜后再慢慢整理合集。"
			: "去灵感页挑菜后即可加入这个合集，也可以先手动补录。"
);
const emptyStateArt = computed(() =>
	activeTab.value === "collection" ? emptyCollectionIllustration : emptyStateIllustration
);
const sheetTitle = computed(() => "添加菜谱");
const fabText = computed(() => {
	return "添加";
});

onShow(() => {
	void loadActiveTab();
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
		void loadActiveTab();
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
			void loadActiveTab();
		}
	}
);

onPageScroll(() => {
	if (activeTab.value === "inspiration") return;
	fabHidden.value = true;
	if (scrollTimer) clearTimeout(scrollTimer);
	scrollTimer = setTimeout(() => {
		fabHidden.value = false;
		scrollTimer = null;
	}, 180);
});

onUnmounted(() => {
	if (scrollTimer) clearTimeout(scrollTimer);
	if (sheetTimer) clearTimeout(sheetTimer);
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
	void loadActiveTab();
}

function changeCategory(categoryId: UUID | "") {
	if (currentCategoryId.value === categoryId) return;
	if (activeTab.value === "my") {
		myCategoryId.value = categoryId;
	} else if (activeTab.value === "inspiration") {
		inspirationCategoryId.value = categoryId;
	} else {
		collectionSceneId.value = categoryId;
	}
	void loadActiveTab();
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

function toggleFilters() {
	if (showFilters.value) {
		closeFilters();
		return;
	}
	syncFilterDraft();
	showFilters.value = true;
}

function searchCurrent() {
	void loadActiveTab();
}

function clearKeyword() {
	if (!keyword.value) return;
	keyword.value = "";
}

function closeFilters() {
	showFilters.value = false;
}

function resetInspirationFilters() {
	inspirationSort.value = "RECOMMENDED";
	inspirationDifficulty.value = "";
	inspirationDuration.value = "";
	filterSort.value = "RECOMMENDED";
	filterDifficulty.value = "";
	filterDuration.value = "";
}

function syncFilterDraft() {
	filterSort.value = inspirationSort.value;
	filterDifficulty.value = inspirationDifficulty.value;
	filterDuration.value = inspirationDuration.value;
}

function resetFilters() {
	filterSort.value = "RECOMMENDED";
	filterDifficulty.value = "";
	filterDuration.value = "";
}

function applyFilters() {
	const changed =
		filterSort.value !== inspirationSort.value ||
		filterDifficulty.value !== inspirationDifficulty.value ||
		filterDuration.value !== inspirationDuration.value;
	inspirationSort.value = filterSort.value;
	inspirationDifficulty.value = filterDifficulty.value;
	inspirationDuration.value = filterDuration.value;
	showFilters.value = false;
	if (changed) {
		void loadActiveTab();
	}
}

async function loadActiveTab() {
	if (loading.value) return;
	errorText.value = "";

	if (activeTab.value === "collection") {
		if (sessionStore.isLoggedIn) {
			loading.value = true;
			try {
				const result = await recipeApi.listCollections();
				collectionScenes.value = result.items;
				if (collectionScenes.value.length && !collectionScenes.value.some(item => item.id === collectionSceneId.value)) {
					collectionSceneId.value = collectionScenes.value[0].id;
				}
				if (!collectionScenes.value.length) {
					collectionSceneId.value = "";
					collectionRecipes.value = [];
					return;
				}
				const list = await recipeApi.listCollectionRecipes({
					page: 1,
					pageSize: 20,
					keyword: keywordText.value || undefined,
					sceneId: collectionSceneId.value || undefined
				});
				collectionRecipes.value = list.items;
			} catch (error) {
				errorText.value = error instanceof Error ? error.message : "合集加载失败";
				collectionRecipes.value = [];
			} finally {
				loading.value = false;
			}
		} else {
			collectionScenes.value = [];
			collectionSceneId.value = "";
			collectionRecipes.value = [];
		}
		return;
	}

	loading.value = true;
	try {
		if (activeTab.value === "my") {
			if (!sessionStore.isLoggedIn) return;
			if (!myCategories.value.length) {
				myCategories.value = await recipeApi.listCategories();
			}
			const result = await recipeApi.listMyRecipes({
				page: 1,
				pageSize: 50,
				keyword: keywordText.value || undefined,
				categoryId: myCategoryId.value || undefined
			});
			myRecipes.value = result.items;
			return;
		}

		if (!inspirationCategories.value.length) {
			inspirationCategories.value = await recipeApi.listInspirationCategories();
		}
		const result = await recipeApi.listInspirationRecipes({
			page: 1,
			pageSize: 20,
			keyword: keywordText.value || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined,
			duration: inspirationDuration.value || undefined
		});
		inspirationRecipes.value = result.items;
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "菜谱加载失败";
	} finally {
		loading.value = false;
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
	if (sheetTimer) {
		clearTimeout(sheetTimer);
		sheetTimer = null;
	}
	if (sheetMode.value === "my" && sheetVisible.value) return;
	sheetMode.value = "my";
	sheetVisible.value = false;
	void nextTick(() => {
		sheetVisible.value = true;
	});
}

function closeSheet() {
	if (!sheetMode.value) return;
	sheetVisible.value = false;
	if (sheetTimer) {
		clearTimeout(sheetTimer);
	}
	sheetTimer = setTimeout(() => {
		sheetMode.value = "";
		sheetTimer = null;
	}, SHEET_ANIMATION_MS);
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
			void loadActiveTab();
		});
		return;
	}

	if (activeTab.value === "inspiration") {
		return;
	}

	openAddSheet();
}

function openRecipeEditor() {
	closeSheet();
	void uniPlatform.navigation.navigateTo("/pages_recipe/edit/index");
}

function goToInspiration() {
	closeSheet();
	activeTab.value = "inspiration";
	errorText.value = "";
	showFilters.value = false;
	void loadActiveTab();
}

function formatDifficulty(value: RecipeDifficulty | null) {
	if (value === "BEGINNER") return "新手友好";
	if (value === "EASY") return "轻松上手";
	if (value === "SKILLED") return "需要经验";
	if (value === "CHALLENGING") return "进阶挑战";
	return "未设难度";
}

function formatDuration(value: RecipeDuration | null) {
	if (value === "WITHIN_15") return "15分钟内";
	if (value === "BETWEEN_15_30") return "15~30分钟";
	if (value === "BETWEEN_30_60") return "30~60分钟";
	if (value === "OVER_60") return "1小时以上";
	return "未设时长";
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
		meta: formatDuration(item.duration),
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
		meta: formatDuration(item.duration),
		tag: formatMetricCount(item.collectCount),
		subline: "",
		kind: "inspiration"
	};
}

function toCollectionCard(item: CollectedRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		coverTag: "",
		meta: formatDuration(item.duration),
		tag: "",
		subline: "",
		kind: "collection"
	};
}
</script>

<style scoped lang="scss">
.recipe-page {
  position: relative;
  padding: 10rpx var(--space-page) calc(140rpx + env(safe-area-inset-bottom));
}

.recipe-page::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 12rpx;
  background: var(--color-page);
  pointer-events: none;
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

.search-row {
  margin-top: 12rpx;
}

.sticky-wrap {
  position: sticky;
  z-index: 20;
  margin-top: 20rpx;
  padding-bottom: 20rpx;
  background: var(--color-page);
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

.collection-board {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: var(--space-md);
  padding: 32rpx 30rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 30rpx;
  background: var(--color-surface);
  box-shadow: 0 20rpx 48rpx rgba(41, 59, 47, 0.08);
}

.collection-board__title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-bold);
}

.collection-board__desc {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: var(--line-height-loose);
}

.collection-board__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 8rpx;
}

.collection-board__button {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 84rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  font-size: 28rpx;
}

.collection-board__button--ghost {
  background: var(--color-surface-muted);
  color: var(--color-primary);
}

.notice {
  color: var(--color-text-secondary);
}

.list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
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

.sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.sheet__title {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
}

.sheet__close {
  color: var(--color-text-tertiary);
  font-size: 36rpx;
  line-height: 1;
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
