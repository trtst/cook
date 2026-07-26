<template>
  <Layout current-tab="recipe" :show-left="false" navbar-layout="custom-left" full-screen>
    <template #navbar-left>
      <view class="nav-tabs">
        <view
          v-for="item in tabs"
          :key="item.value"
          class="nav-tabs__item"
          :class="{ 'nav-tabs__item--active': activeTab === item.value }"
          @click="switchTab(item.value)"
        >
          {{ item.label }}
        </view>
      </view>
    </template>

    <view class="recipe-page">
      <view class="search-row">
        <view class="search-row__field" :class="{ 'search-row__field--disabled': activeTab === 'collection' }">
          <image class="search-row__icon" :src="searchIcon" mode="aspectFit" />
          <input
            v-model="keyword"
            class="search-row__input"
            :disabled="activeTab === 'collection'"
            placeholder="搜索菜谱、食材"
            confirm-type="search"
            @confirm="searchCurrent"
          />
        </view>
      </view>

      <view v-if="showStickyControls" class="sticky-wrap" :style="stickyStyle">
        <scroll-view v-if="showCategoryBar" scroll-x class="category-scroll" show-scrollbar="false">
          <view class="category-row">
            <view
              v-for="item in categoryItems"
              :key="item.id"
              class="category-chip"
              :class="{ 'category-chip--active': currentCategoryId === item.id }"
              @click="changeCategory(item.id)"
            >
              <text class="category-chip__name">{{ item.name }}</text>
            </view>
          </view>
        </scroll-view>

        <view v-if="activeTab === 'inspiration'" class="tool-row">
          <view class="tool-row__label">灵感广场</view>
          <view class="tool-row__action" @click="toggleFilters">
            <text>{{ showFilters ? "收起筛选" : "筛选" }}</text>
          </view>
        </view>

        <view v-if="activeTab === 'inspiration' && showFilters" class="filter-panel">
          <view class="filter-group">
            <text class="filter-group__title">排序</text>
            <view class="filter-group__chips">
              <view
                v-for="item in sortItems"
                :key="item.value"
                class="filter-chip"
                :class="{ 'filter-chip--active': inspirationSort === item.value }"
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
                :class="{ 'filter-chip--active': inspirationDifficulty === item.value }"
                @click="changeDifficulty(item.value)"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <template>
        <view v-if="errorText" class="notice" @click="loadActiveTab">{{ errorText }}</view>
        <view v-else-if="loading" class="notice">加载中...</view>

        <view
          v-else-if="showRecipeEmpty"
          class="recipe-empty"
          hover-class="recipe-empty--hover"
          hover-stay-time="100"
          @click="handleEmptyClick"
        >
          <image class="recipe-empty__art" :src="emptyStateArt" mode="aspectFit" />
          <text class="recipe-empty__title">{{ emptyStateTitle }}</text>
          <text class="recipe-empty__description">{{ emptyStateDescription }}</text>
        </view>

        <Empty
          v-else-if="!cards.length"
          title="还没有灵感菜谱"
          description="换个分类或筛选条件再看看。"
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
              <text class="recipe-card__cover-text">{{ item.title.slice(0, 1) }}</text>
            </view>

            <view class="recipe-card__main">
              <text class="recipe-card__title">{{ item.title }}</text>
              <text class="recipe-card__meta">{{ item.meta }}</text>
              <text class="recipe-card__sub">{{ item.subline }}</text>
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
        @click="openManage"
      >
        <image class="manage-fab__icon" :src="manageIcon" mode="aspectFit" />
        <text class="manage-fab__text">管理</text>
      </view>

      <view v-if="sheetMode" class="action-sheet" @click="closeSheet">
        <view class="action-sheet__mask" />
        <view class="action-sheet__panel" @click.stop>
          <view class="action-sheet__header">
            <text class="action-sheet__title">{{ sheetTitle }}</text>
            <text class="action-sheet__close" @click="closeSheet">×</text>
          </view>

          <template v-if="sheetMode === 'my'">
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
          </template>

          <template v-else-if="sheetMode === 'collection'">
            <view class="collection-sheet">
              <text class="collection-sheet__hint">先创建一个合集，后续收藏灵感菜谱时就能直接加入。</text>
              <input
                v-model="collectionName"
                class="collection-sheet__input"
                maxlength="20"
                placeholder="请输入合集名称"
                :disabled="sheetSubmitting"
              />

              <view
                class="collection-sheet__submit"
                :class="{ 'collection-sheet__submit--disabled': sheetSubmitting }"
                @click="createCollection"
              >
                {{ sheetSubmitting ? "创建中..." : "创建合集" }}
              </view>

              <view class="collection-sheet__ghost" @click="goToInspiration">
                去灵感添加菜谱
              </view>
            </view>
          </template>

          <template v-else>
            <view class="collection-sheet">
              <text class="collection-sheet__hint">当前合集还没有菜谱，去灵感页收藏后就能加入到这里。</text>

              <view class="collection-sheet__submit" @click="goToInspiration">
                去灵感添加菜谱
              </view>
            </view>
          </template>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { onPageScroll, onShow } from "@dcloudio/uni-app";
import emptyCollectionIllustration from "@/assets/recipe-page/empty-collection.svg";
import emptyStateIllustration from "@/assets/recipe-page/empty-state.svg";
import manageIcon from "@/assets/recipe-page/manage.svg";
import searchIcon from "@/assets/recipe-page/search.svg";
import {
	recipeApi,
	type InspirationCategorySummary,
	type InspirationRecipeSummary,
	type InspirationSort,
	type MyRecipeSummary,
	type RecipeCategorySummary,
	type RecipeSceneSummary,
	type RecipeDifficulty
} from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type RecipeTab = "my" | "inspiration" | "collection";
type SheetMode = "" | "my" | "collection" | "collection-add";

interface CategoryItem {
	id: string;
	name: string;
}

interface CardItem {
	id: string;
	title: string;
	meta: string;
	subline: string;
	kind: "my" | "inspiration";
}

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
	{ value: "EASY" as const, label: "简单" },
	{ value: "MEDIUM" as const, label: "中等" },
	{ value: "HARD" as const, label: "困难" }
];

const activeTab = ref<RecipeTab>(sessionStore.isLoggedIn ? "my" : "inspiration");
const keyword = ref("");
const showFilters = ref(false);
const loading = ref(false);
const errorText = ref("");
const fabHidden = ref(false);
const myCategories = ref<RecipeCategorySummary[]>([]);
const inspirationCategories = ref<InspirationCategorySummary[]>([]);
const collectionScenes = ref<RecipeSceneSummary[]>([]);
const myCategoryId = ref("");
const inspirationCategoryId = ref("");
const collectionSceneId = ref("");
const inspirationSort = ref<InspirationSort>("RECOMMENDED");
const inspirationDifficulty = ref<RecipeDifficulty | "">("");
const myRecipes = ref<MyRecipeSummary[]>([]);
const inspirationRecipes = ref<InspirationRecipeSummary[]>([]);
const loginIntentTab = ref<RecipeTab | null>(null);
const sheetMode = ref<SheetMode>("");
const collectionName = ref("");
const sheetSubmitting = ref(false);

let scrollTimer: ReturnType<typeof setTimeout> | null = null;

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
const currentCategoryId = computed(() => {
	if (activeTab.value === "my") return myCategoryId.value;
	if (activeTab.value === "inspiration") return inspirationCategoryId.value;
	return collectionSceneId.value;
});
const cards = computed<CardItem[]>(() => {
	if (activeTab.value === "my") return myRecipes.value.map(toMyCard);
	if (activeTab.value === "inspiration") return inspirationRecipes.value.map(toInspirationCard);
	return [];
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
const showRecipeEmpty = computed(() => activeTab.value === "my" || activeTab.value === "collection");
const emptyStateTitle = computed(() => {
	if (activeTab.value === "my") return "添加你的第一道菜谱";
	return collectionNeedsCreate.value ? "创建合集并添加菜谱" : "给合集添加菜谱";
});
const emptyStateDescription = computed(() =>
	activeTab.value === "my"
		? "记录家常拿手菜、灵感改编和做法草稿，点一下就开始添加。"
		: collectionNeedsCreate.value
			? "先创建一个合集，后续可把灵感菜谱收藏进来统一整理。"
			: "去灵感页收藏菜谱，或切换到别的合集看看。"
);
const emptyStateArt = computed(() => (activeTab.value === "my" ? emptyStateIllustration : emptyCollectionIllustration));
const sheetTitle = computed(() => {
	if (sheetMode.value === "my") return "添加菜谱";
	if (sheetMode.value === "collection") return "创建合集";
	return "添加菜谱到合集";
});

onShow(() => {
	void loadActiveTab();
});

watch(
	() => sessionStore.isLoggedIn,
	isLoggedIn => {
		if (isLoggedIn && !loginIntentTab.value && activeTab.value !== "my") {
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
});

function switchTab(tab: RecipeTab) {
	if (activeTab.value === tab) return;
	activeTab.value = tab;
	errorText.value = "";
	keyword.value = "";
	closeSheet();
	if (tab !== "inspiration") {
		showFilters.value = false;
	}
	void loadActiveTab();
}

function changeCategory(categoryId: string) {
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
	if (inspirationSort.value === value) return;
	inspirationSort.value = value;
	void loadActiveTab();
}

function changeDifficulty(value: RecipeDifficulty | "") {
	if (inspirationDifficulty.value === value) return;
	inspirationDifficulty.value = value;
	void loadActiveTab();
}

function toggleFilters() {
	showFilters.value = !showFilters.value;
}

function searchCurrent() {
	if (activeTab.value === "collection") return;
	void loadActiveTab();
}

async function loadActiveTab() {
	if (loading.value) return;
	errorText.value = "";

	if (activeTab.value === "collection") {
		if (sessionStore.isLoggedIn) {
			loading.value = true;
			try {
				collectionScenes.value = await recipeApi.listScenes();
			} catch (error) {
				errorText.value = error instanceof Error ? error.message : "合集加载失败";
			} finally {
				loading.value = false;
			}
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
				pageSize: 20,
				keyword: keyword.value.trim() || undefined,
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
			keyword: keyword.value.trim() || undefined,
			categoryId: inspirationCategoryId.value || undefined,
			sort: inspirationSort.value,
			difficulty: inspirationDifficulty.value || undefined
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
		`/pages_recipe/detail/index?recipeId=${encodeURIComponent(item.id)}&kind=${item.kind}`
	);
}

function openManage() {
	closeSheet();
	void uniPlatform.navigation.navigateTo("/pages_recipe/list/index");
}

function closeSheet() {
	sheetMode.value = "";
	collectionName.value = "";
	sheetSubmitting.value = false;
}

function handleEmptyClick() {
	if (!sessionStore.isLoggedIn) {
		loginIntentTab.value = activeTab.value;
		loginModalStore.open(null, () => {
			loginIntentTab.value = null;
			void loadActiveTab();
		});
		return;
	}

	if (activeTab.value === "my") {
		sheetMode.value = "my";
		return;
	}

	sheetMode.value = collectionNeedsCreate.value ? "collection" : "collection-add";
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

async function createCollection() {
	const name = collectionName.value.trim();
	if (!name || sheetSubmitting.value) return;

	sheetSubmitting.value = true;
	try {
		const scene = await recipeApi.createScene({
			operationId: createOperationId(),
			name
		});
		collectionScenes.value = [...collectionScenes.value, scene];
		collectionSceneId.value = scene.id;
		closeSheet();
		await uniPlatform.feedback.toast({ title: "合集已创建", icon: "success" }).catch(() => undefined);
	} catch (error) {
		await uniPlatform.feedback.toast({
			title: error instanceof Error ? error.message : "创建失败",
			icon: "none"
		}).catch(() => undefined);
		sheetSubmitting.value = false;
	}
}

function formatDifficulty(value: RecipeDifficulty | null) {
	if (value === "EASY") return "简单";
	if (value === "MEDIUM") return "中等";
	if (value === "HARD") return "困难";
	return "未设难度";
}

function formatDuration(value: number | null) {
	return value ? `${value} 分钟` : "未设时长";
}

function toMyCard(item: MyRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		meta: `${formatDifficulty(item.difficulty)} · ${formatDuration(item.durationMinutes)}`,
		subline: `${item.category.name} · 更新于 ${item.updatedAt.slice(0, 10)}`,
		kind: "my"
	};
}

function toInspirationCard(item: InspirationRecipeSummary): CardItem {
	return {
		id: item.id,
		title: item.title,
		meta: `${formatDifficulty(item.difficulty)} · ${formatDuration(item.durationMinutes)}`,
		subline: `${item.category.name} · ${item.likeCount} 赞 · ${item.collectCount} 收藏`,
		kind: "inspiration"
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
  border-radius: 999rpx;
  background: var(--theme-primary);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.search-row {
  margin-top: 12rpx;
}

.search-row__field {
  display: flex;
  align-items: center;
  height: 80rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  box-sizing: border-box;
}

.search-row__field--disabled {
  opacity: 0.7;
}

.search-row__icon {
  flex: 0 0 48rpx;
  width: 48rpx;
  height: 48rpx;
}

.search-row__input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  padding: 0 0 0 16rpx;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-medium);
}

.sticky-wrap {
  position: sticky;
  z-index: 10;
  margin-top: 18rpx;
  padding-bottom: var(--space-sm);
  background: var(--color-page);
}

.category-scroll {
  white-space: nowrap;
}

.category-row,
.filter-group__chips,
.tool-row {
  display: flex;
  gap: 16rpx;
}

.category-row {
  width: max-content;
  padding-right: 24rpx;
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
  border-radius: var(--radius-pill);
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

.tool-row {
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
}

.tool-row__label {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.tool-row__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.filter-panel,
.notice,
.recipe-card,
.login-card {
  margin-top: var(--space-md);
}

.filter-panel {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
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

.notice,
.recipe-card {
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.recipe-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: var(--space-md);
  padding: 40rpx 28rpx 44rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 36rpx;
  background: linear-gradient(180deg, var(--color-surface) 0%, var(--entry-board-bg) 100%);
  text-align: center;
}

.recipe-empty--hover {
  opacity: 0.9;
}

.recipe-empty__art {
  width: 420rpx;
  height: 300rpx;
}

.recipe-empty__title,
.recipe-empty__description {
  display: block;
}

.recipe-empty__title {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.recipe-empty__description {
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
}

.notice {
  color: var(--color-text-secondary);
}

.list {
  margin-top: var(--space-md);
}

.recipe-card {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.recipe-card + .recipe-card {
  margin-top: var(--space-sm);
}

.recipe-card--hover,
.manage-fab--hover {
  opacity: 0.86;
}

.recipe-card__cover {
  display: flex;
  flex: 0 0 112rpx;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, var(--color-primary-soft), var(--color-surface-muted));
}

.recipe-card__cover-text {
  color: var(--color-primary);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
}

.recipe-card__main {
  flex: 1;
  min-width: 0;
}

.recipe-card__title,
.recipe-card__meta,
.recipe-card__sub {
  display: block;
}

.recipe-card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.recipe-card__meta,
.recipe-card__sub {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
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
  border-radius: 999rpx;
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

.action-sheet {
  position: fixed;
  inset: 0;
  z-index: 1300;
}

.action-sheet__mask {
  position: absolute;
  inset: 0;
  background: var(--login-popup-backdrop-bg);
}

.action-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 36rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: linear-gradient(180deg, var(--login-popup-sheet-overlay-start) 0%, var(--login-popup-sheet-overlay-end) 100%);
  box-shadow: var(--login-popup-sheet-shadow);
}

.action-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.action-sheet__title {
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
}

.action-sheet__close {
  color: var(--color-text-tertiary);
  font-size: 64rpx;
  line-height: 1;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.74);
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

.collection-sheet__hint {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-loose);
}

.collection-sheet__input {
  width: 100%;
  height: 92rpx;
  margin-top: 24rpx;
  padding: 0 26rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.9);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 28rpx;
}

.collection-sheet__submit,
.collection-sheet__ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border-radius: var(--radius-pill);
  font-size: 30rpx;
}

.collection-sheet__submit {
  height: 96rpx;
  margin-top: 24rpx;
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.collection-sheet__submit--disabled {
  opacity: 0.7;
}

.collection-sheet__ghost {
  height: 88rpx;
  margin-top: 16rpx;
  border: 2rpx solid var(--login-popup-ghost-border);
  background: var(--login-popup-ghost-bg);
  color: var(--login-popup-ghost-text);
}
</style>
