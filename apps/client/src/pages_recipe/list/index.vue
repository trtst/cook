<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" :show-left="false" navbar-layout="custom-left" full-screen>
    <template #navbar-left>
      <view class="list-nav">
        <view class="cookfont icon-back list-nav__back" hover-class="list-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <view class="tabs">
          <view class="tab" :class="{ 'tab--active': mode === 'recipes' }" @click="switchMode('recipes')">我的菜谱</view>
          <view class="tab" :class="{ 'tab--active': mode === 'drafts' }" @click="switchMode('drafts')">草稿箱</view>
        </view>
      </view>
    </template>
    <template v-if="sessionStore.isLoggedIn" #navbar-right>
      <view class="list-nav__action" @click="createRecipe">新建菜谱</view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后管理菜谱"
      description="这里查看我的已发布菜谱和草稿箱。"
      @success="handleLoginSuccess"
    />

    <view v-else class="list-page">
      <view class="search-row">
        <RecipeSearchBar
          v-model="keyword"
          placeholder="搜索菜谱、食材"
          @confirm="loadList"
          @clear="clearKeyword"
        />
      </view>

      <view class="list-scroll-wrap">
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
          class="list-scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          :lower-threshold="120"
          @scrolltolower="loadMore"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view v-if="errorText" class="notice" @click="retryLoadList">{{ errorText }}</view>
          <view v-else-if="loading && !items.length" class="notice">加载中...</view>
          <Empty
            v-else-if="!items.length"
            :art="emptyStateIllustration"
            :title="mode === 'recipes' ? '还没有我的菜谱' : '草稿箱还是空的'"
            :description="mode === 'recipes' ? '先新建一份属于你的菜谱，常做的家常菜和灵感改编都可以记在这里。' : '编辑页存下的草稿会先出现在这里，整理好后再继续发布。'"
          />

          <view v-else class="list">
            <view v-for="item in items" :key="item.id" class="card" @click="openItem(item)">
              <view class="card__cover">
                <image
                  v-if="item.coverImageUrl"
                  class="card__cover-image"
                  :src="item.coverImageUrl"
                  mode="aspectFill"
                />
                <view v-else class="card__cover-fallback">
                  <text v-if="mode !== 'drafts'" class="card__cover-text font-black">封面</text>
                </view>
              </view>
              <view class="card__body">
                <text class="card__title">{{ item.title }}</text>
                <view class="card__foot">
                  <text class="card__meta">{{ item.meta }}</text>
                  <view class="card__action-row">
                    <text class="card__tail">{{ item.updatedAtText }}</text>
                    <text
                      class="card__danger"
                      :class="{
                        'card__danger--disabled': mode === 'drafts' ? deletingDraftId === item.id : deletingRecipeId === item.id
                      }"
                      @click.stop="mode === 'drafts' ? removeDraft(item) : removeRecipe(item)"
                    >
                      {{
                        mode === "drafts"
                          ? deletingDraftId === item.id
                            ? "删除中..."
                            : "删除草稿"
                          : deletingRecipeId === item.id
                            ? "删除中..."
                            : "删除"
                      }}
                    </text>
                  </view>
                </view>
              </view>
            </view>

            <view v-if="showFooter" class="list-footer">{{ footerText }}</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import emptyStateIllustration from "@/assets/recipe-page/empty-state.svg";
import type { UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary, type RecipeDraftSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { getRecipeViewVersion, markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeSecond } from "../utils/date";
import { createOperationId } from "@/utils/operation-id";

type ListMode = "recipes" | "drafts";
type LoadSource = "idle" | "initial" | "search" | "refresh" | "switch" | "retry";

interface DisplayItem {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	meta: string;
	updatedAt: string;
	updatedAtText: string;
	raw: MyRecipeSummary | RecipeDraftSummary;
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
const loadingTips = [
	"帮你翻翻最近做过的菜",
	"先把常做菜端上桌",
	"草稿本翻页中，马上就好",
	"替你把这顿饭重新理一遍",
	"锅里翻找中，马上出结果",
	"灶台预热中，列表马上更新"
];

const mode = ref<ListMode>("recipes");
const keyword = ref("");
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const cachedItems = ref<Record<ListMode, DisplayItem[]>>({
	recipes: [],
	drafts: []
});
const loadedVersions = ref<Record<ListMode, number | null>>({
	recipes: null,
	drafts: null
});
const loadedKeywords = ref<Record<ListMode, string>>({
	recipes: "",
	drafts: ""
});
const loadedPages = ref<Record<ListMode, number>>({
	recipes: 0,
	drafts: 0
});
const hasNextMap = ref<Record<ListMode, boolean>>({
	recipes: false,
	drafts: false
});
const loadSource = ref<LoadSource>("idle");
const deletingDraftId = ref<UUID | "">("");
const deletingRecipeId = ref<UUID | "">("");
const keywordText = computed(() => keyword.value.trim());
const items = computed(() => cachedItems.value[mode.value]);
const currentHasNext = computed(() => hasNextMap.value[mode.value]);
const footerText = computed(() => {
	if (loadingMore.value) return "加载更多中...";
	return currentHasNext.value ? "上滑继续加载" : "没有更多了";
});
const showFooter = computed(() => items.value.length > 0 && !errorText.value);
const inlineLoading = computed(() => loading.value && items.value.length > 0 && loadSource.value !== "refresh");
const inlineLoadingText = computed(() => {
	if (loadSource.value === "search") {
		return ["搜一搜你的菜谱草稿", "帮你翻找菜谱和食材", "先帮你从草稿本里找找"];
	}
	return loadingTips;
});
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

onLoad((query) => {
	const rawMode = Array.isArray(query?.mode) ? query.mode[0] : query?.mode;
	mode.value = rawMode === "drafts" ? "drafts" : "recipes";
});

onShow(() => {
	if (!sessionStore.isLoggedIn) return;
	void loadList();
});

watch(keywordText, (nextValue, previousValue) => {
	if (!nextValue && previousValue && sessionStore.isLoggedIn) {
		void loadList({ force: true, source: "search" });
	}
});

function handleLoginSuccess() {
	void loadList({ force: true, source: "switch" });
}

function switchMode(nextMode: ListMode) {
	if (mode.value === nextMode) return;
	mode.value = nextMode;
	errorText.value = "";
	void loadList({ source: "switch" });
}

function clearKeyword() {
	if (!keyword.value) return;
	keyword.value = "";
}

function retryLoadList() {
	void loadList({ force: true, source: "retry" });
}

function getManageScope(currentMode: ListMode) {
	return currentMode === "recipes" ? "manage-recipes" as const : "manage-drafts" as const;
}

function syncModeLoadState(currentMode: ListMode) {
	loadedVersions.value[currentMode] = getRecipeViewVersion(getManageScope(currentMode));
	loadedKeywords.value[currentMode] = keywordText.value;
}

function shouldLoadMode(currentMode: ListMode, force = false) {
	if (force) return true;
	return (
		loadedVersions.value[currentMode] !== getRecipeViewVersion(getManageScope(currentMode)) ||
		loadedKeywords.value[currentMode] !== keywordText.value
	);
}

async function loadList(options: { force?: boolean; source?: LoadSource } = {}) {
	const currentMode = mode.value;
	const source = options.source ?? "initial";
	if (!sessionStore.isLoggedIn || loading.value || loadingMore.value || !shouldLoadMode(currentMode, options.force)) return false;
	loading.value = true;
	loadSource.value = source;
	errorText.value = "";
	let success = false;
	try {
		if (currentMode === "recipes") {
			const result = await recipeApi.listMyRecipes({
				page: 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = result.items.map(toRecipeItem);
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
		} else {
			const result = await recipeApi.listDrafts({
				page: 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = result.items.map(toDraftItem);
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
		}
		syncModeLoadState(currentMode);
		success = true;
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "列表加载失败";
	} finally {
		loading.value = false;
		loadSource.value = "idle";
	}
	return success;
}

async function loadMore() {
	const currentMode = mode.value;
	if (!sessionStore.isLoggedIn || loading.value || loadingMore.value || !hasNextMap.value[currentMode]) return;

	loadingMore.value = true;
	errorText.value = "";

	try {
		if (currentMode === "recipes") {
			const result = await recipeApi.listMyRecipes({
				page: loadedPages.value[currentMode] + 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = [...cachedItems.value[currentMode], ...result.items.map(toRecipeItem)];
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
		} else {
			const result = await recipeApi.listDrafts({
				page: loadedPages.value[currentMode] + 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = [...cachedItems.value[currentMode], ...result.items.map(toDraftItem)];
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
		}
		syncModeLoadState(currentMode);
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
		const success = await loadList({ force: true, source: "refresh" });
		if (success) {
			await onRefreshComplete();
		}
	} finally {
		onRefresherRestore();
	}
}

function createRecipe() {
	void uniPlatform.navigation.navigateTo("/pages_recipe/edit/index");
}

function goBack() {
	if (getCurrentPages().length > 1) {
		void uniPlatform.navigation.navigateBack();
		return;
	}
	void uniPlatform.navigation.switchTab("/pages/recipe/index");
}

function openItem(item: DisplayItem) {
	if ((deletingDraftId.value && deletingDraftId.value === item.id) || (deletingRecipeId.value && deletingRecipeId.value === item.id)) return;
	if (mode.value === "recipes") {
		void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.id))}&kind=my`);
		return;
	}
	void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?draftId=${encodeURIComponent(String(item.id))}`);
}

async function removeRecipe(item: DisplayItem) {
	if (mode.value !== "recipes" || deletingRecipeId.value) return;
	const recipe = item.raw as MyRecipeSummary;
	const confirmed = await uniPlatform.feedback.confirm({
		title: "删除菜谱",
		content: `确定删除“${item.title}”吗？删除后会按当前套餐规则进入回收或彻底删除。`,
		confirmText: "删除",
		cancelText: "取消",
		tone: "danger",
		maskClosable: true
	});
	if (!confirmed) return;

	deletingRecipeId.value = item.id;
	try {
		await recipeApi.deleteRecipe(item.id, createOperationId(), recipe.version);
		cachedItems.value.recipes = cachedItems.value.recipes.filter(current => current.id !== item.id);
		markRecipeHomeDirty(["my"]);
		markRecipeManageDirty(["recipes"]);
		syncModeLoadState("recipes");
		await uniPlatform.feedback.toast({ title: "菜谱已删除", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
	} finally {
		deletingRecipeId.value = "";
	}
}

async function removeDraft(item: DisplayItem) {
	if (mode.value !== "drafts" || deletingDraftId.value) return;
	const draft = item.raw as RecipeDraftSummary;
	const confirmed = await uniPlatform.feedback.confirm({
		title: "删除草稿",
		content: `确定删除“${item.title}”吗？删除后无法恢复。`,
		confirmText: "删除",
		cancelText: "取消",
		tone: "danger",
		maskClosable: true
	});
	if (!confirmed) return;

	deletingDraftId.value = item.id;
	try {
		await recipeApi.deleteDraft(item.id, {
			operationId: createOperationId(),
			expectedVersion: draft.version
		});
		cachedItems.value.drafts = cachedItems.value.drafts.filter(current => current.id !== item.id);
		markRecipeManageDirty(["drafts"]);
		syncModeLoadState("drafts");
		await uniPlatform.feedback.toast({ title: "草稿已删除", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
	} finally {
		deletingDraftId.value = "";
	}
}

function toRecipeItem(item: MyRecipeSummary): DisplayItem {
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		meta: `${item.category.name} · ${item.difficultyText || "未设置难度"} · ${item.durationText || "未设置时长"}`,
		updatedAt: item.updatedAt,
		updatedAtText: formatDateTimeSecond(item.updatedAt),
		raw: item
	};
}

function toDraftItem(item: RecipeDraftSummary): DisplayItem {
	return {
		id: item.id,
		title: item.title || "未命名草稿",
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		meta: `${item.category?.name ?? "未选分类"} · 草稿版本 ${item.version}`,
		updatedAt: item.updatedAt,
		updatedAtText: formatDateTimeSecond(item.updatedAt),
		raw: item
	};
}
</script>

<style scoped lang="scss">
.list-nav,
.tabs,
.card,
.card__foot {
	display: flex;
}

.list-nav {
	align-items: center;
	gap: 18rpx;
	min-width: 0;
}

.list-nav__back {
	display: flex;
	align-items: center;
	width: 64rpx;
	height: 64rpx;
	color: var(--color-text);
	font-size: 34rpx;
	line-height: 1;
}

.list-nav__back--hover,
.list-nav__action:active,
.card:active {
	opacity: 0.82;
}

.list-nav__action {
	padding: 0 8rpx;
	color: var(--color-text);
	font-size: 24rpx;
	font-weight: var(--font-weight-semibold);
	line-height: 60rpx;
}

.tabs {
	flex: 1;
	gap: 24rpx;
	min-width: 0;
}

.tab {
	position: relative;
	z-index: 0;
	flex: 0 0 auto;
	padding: 8rpx 0 12rpx;
	color: var(--color-text-secondary);
	font-size: 34rpx;
	font-weight: var(--font-weight-bold);
	line-height: 1;
	white-space: nowrap;
}

.tab--active {
	color: var(--color-text);
}

.tab--active::after {
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
	padding: 10rpx var(--space-page) 0;
}

.list-page {
	display: flex;
	flex-direction: column;
	flex: 1;
	height: 100%;
	min-height: 0;
	overflow: hidden;
}

.list-scroll {
	flex: 1;
	min-height: 0;
}

.list-scroll-wrap {
	display: flex;
	position: relative;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

.notice {
	margin-top: var(--space-md);
	padding: var(--space-md);
	border-radius: var(--radius-md);
	background: var(--color-surface-muted);
	color: var(--color-text-secondary);
}

.list {
	padding: 20rpx var(--space-page) calc(40rpx + env(safe-area-inset-bottom));
}

.list-footer {
	padding: 12rpx 0;
	color: var(--color-text-tertiary);
	font-size: 22rpx;
	line-height: 1.5;
	text-align: center;
}

.card {
	gap: 20rpx;
	align-items: stretch;
	padding: 20rpx;
	border: 1rpx solid rgba(77, 64, 47, 0.08);
	border-radius: var(--radius-xs);
	background: var(--color-surface);
	box-shadow: 0 12rpx 28rpx rgba(57, 44, 31, 0.05);
}

.card + .card {
	margin-top: 20rpx;
}

.card__cover {
	overflow: hidden;
	flex: 0 0 208rpx;
	width: 208rpx;
	height: 156rpx;
	border-radius: var(--radius-xs);
	background: linear-gradient(180deg, rgba(255, 252, 247, 0.94) 0%, rgba(245, 238, 227, 0.96) 100%);
}

.card__cover-image,
.card__cover-fallback {
	width: 100%;
	height: 100%;
}

.card__cover-image {
	display: block;
}

.card__cover-fallback {
	display: flex;
	align-items: center;
	justify-content: center;
}

.card__cover-text {
	color: var(--color-text-secondary);
	opacity: 0.56;
	font-size: 38rpx;
	font-weight: var(--font-weight-heavy);
}

.card__body {
	display: flex;
	flex-direction: column;
	flex: 1;
	justify-content: space-between;
	min-width: 0;
}

.card__title,
.card__meta,
.card__tail,
.card__danger {
	display: block;
}

.card__title {
	color: var(--color-text);
	font-size: 30rpx;
	font-weight: var(--font-weight-semibold);
	line-height: 1.45;
	display: -webkit-box;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.card__foot {
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	gap: 8rpx;
	margin-top: 12rpx;
}

.card__action-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	gap: 16rpx;
}

.card__meta,
.card__tail,
.card__danger {
	color: var(--color-text-secondary);
	font-size: 22rpx;
	line-height: 1.5;
}

.card__meta {
	width: 100%;
	min-width: 0;
}

.card__danger {
	color: var(--color-danger-text);
	flex: 0 0 auto;
	white-space: nowrap;
}

.card__danger--disabled {
	opacity: 0.56;
}

.card__tail {
	flex: 0 0 auto;
	white-space: nowrap;
}
</style>
