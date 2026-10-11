<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-capsule-guard="true">
    <template #navbar-center>
      <view class="list-nav">
        <view class="tabs">
          <view class="tab" :class="{ 'tab--active': mode === 'recipes' }" @click="switchMode('recipes')">我的菜谱</view>
          <view class="tab" :class="{ 'tab--active': mode === 'saved' }" @click="switchMode('saved')">收藏的灵感</view>
          <view class="tab" :class="{ 'tab--active': mode === 'drafts' }" @click="switchMode('drafts')">草稿箱</view>
        </view>
		<view v-if="mode === 'recipes'" class="list-nav__action" @click="createRecipe">新建菜谱</view>
      </view>
    </template>

    <view class="list-page">
      <view class="search-row">
        <RecipeSearchBar
          v-model="keyword"
          placeholder="搜搜菜名、食材或菜品特点，找道想做的菜"
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
          <Empty
            v-if="!sessionStore.isLoggedIn"
            :art="emptyStateIllustration"
            :title="mode === 'recipes' ? '登录后查看我的菜谱' : mode === 'saved' ? '登录后查看收藏的灵感' : '登录后查看草稿箱'"
            :description="mode === 'recipes' ? '登录后管理你的已发布菜谱。' : mode === 'saved' ? '收藏的灵感会保留原整理者和固定版本。' : '登录后继续整理草稿。'"
            clickable
            @click="openLogin"
          />

          <template v-else>
          <view v-if="errorText" class="notice" @click="retryLoadList">{{ errorText }}</view>
          <view v-else-if="loading && !items.length" class="notice">加载中...</view>
          <Empty
            v-else-if="!items.length"
            :art="emptyStateIllustration"
            :title="mode === 'recipes' ? '还没有我的菜谱' : mode === 'saved' ? '还没有收藏的灵感' : '草稿箱还是空的'"
            :description="mode === 'recipes' ? '先新建一份属于你的菜谱，常做的家常菜和灵感改编都可以记在这里。' : mode === 'saved' ? '在灵感页收藏喜欢的菜谱，它们会出现在这里。' : '编辑页存下的草稿会先出现在这里，整理好后再继续发布。'"
          />

          <view v-else class="list-shell">
            <view class="list">
              <RecipeListRow
                v-for="item in items"
                :key="item.id"
                class="card"
                :title="item.title"
                :cover-image-url="item.coverImageUrl"
                :meta="item.meta"
                @click="openItem(item)"
              >
                <template #footer>
                    <view class="card__action-row">
                      <text class="card__tail">{{ item.updatedAtText }}</text>
                      <text
                        class="card__delete"
                        :class="{
                          'card__delete--disabled': mode === 'drafts' ? deletingDraftId === item.id : mode === 'saved' ? removingSaveId === item.id : deletingRecipeId === item.id
                        }"
                        @click.stop="mode === 'drafts' ? removeDraft(item) : mode === 'saved' ? removeSaved(item) : removeRecipe(item)"
                      >
                        {{
                          mode === "drafts"
                            ? deletingDraftId === item.id
                              ? "删除中..."
                              : "删除草稿"
                            : mode === "saved"
                              ? removingSaveId === item.id ? "移除中..." : "移除收藏"
                              : deletingRecipeId === item.id ? "删除中..." : "删除"
                        }}
                      </text>
                    </view>
                </template>
              </RecipeListRow>
            </view>

            <LoadMore
              v-if="showFooter"
              :loading="loadingMore"
              :has-next="currentHasNext"
              :show-done="hasLoadedMoreMap[mode] && !currentHasNext"
            />
          </view>
          </template>
        </scroll-view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import emptyStateIllustration from "@/assets/empty.png";
import type { UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary, type RecipeDraftSummary, type SavedInspirationSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import RecipeListRow from "@/components/Recipe/RecipeListRow.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { useLoginEmptyState } from "../composables/useLoginEmptyState";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { getRecipeViewVersion, markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateTimeSecond } from "../utils/date";
import { createOperationId } from "@/utils/operation-id";

type ListMode = "recipes" | "saved" | "drafts";
type LoadSource = "idle" | "initial" | "search" | "refresh" | "switch" | "retry";

interface DisplayItem {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	meta: string;
	updatedAt: string;
	updatedAtText: string;
	raw: MyRecipeSummary | RecipeDraftSummary | SavedInspirationSummary;
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
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(handleLoginSuccess);
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
	saved: [],
	drafts: []
});
const loadedVersions = ref<Record<ListMode, number | null>>({
	recipes: null,
	saved: null,
	drafts: null
});
const loadedKeywords = ref<Record<ListMode, string>>({
	recipes: "",
	saved: "",
	drafts: ""
});
const loadedPages = ref<Record<ListMode, number>>({
	recipes: 0,
	saved: 0,
	drafts: 0
});
const hasNextMap = ref<Record<ListMode, boolean>>({
	recipes: false,
	saved: false,
	drafts: false
});
const hasLoadedMoreMap = ref<Record<ListMode, boolean>>({
	recipes: false,
	saved: false,
	drafts: false
});
const loadSource = ref<LoadSource>("idle");
const deletingDraftId = ref<UUID | "">("");
const deletingRecipeId = ref<UUID | "">("");
const removingSaveId = ref<UUID | "">("");
const keywordText = computed(() => keyword.value.trim());
const items = computed(() => cachedItems.value[mode.value]);
const currentHasNext = computed(() => hasNextMap.value[mode.value]);
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
	mode.value = rawMode === "drafts" ? "drafts" : rawMode === "saved" ? "saved" : "recipes";
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
	if (currentMode === "recipes") return "manage-recipes" as const;
	if (currentMode === "drafts") return "manage-drafts" as const;
	return "manage-saved" as const;
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
			hasLoadedMoreMap.value[currentMode] = false;
		} else if (currentMode === "saved") {
			const result = await recipeApi.listSavedInspirations({ page: 1, pageSize: 20, keyword: keywordText.value || undefined });
			cachedItems.value.saved = result.items.map(toSavedItem);
			loadedPages.value.saved = result.page;
			hasNextMap.value.saved = result.hasNext;
			hasLoadedMoreMap.value.saved = false;
		} else {
			const result = await recipeApi.listDrafts({
				page: 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = result.items.map(toDraftItem);
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
			hasLoadedMoreMap.value[currentMode] = false;
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
			if (result.items.length > 0) {
				hasLoadedMoreMap.value[currentMode] = true;
			}
		} else if (currentMode === "saved") {
			const result = await recipeApi.listSavedInspirations({
				page: loadedPages.value.saved + 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value.saved = [...cachedItems.value.saved, ...result.items.map(toSavedItem)];
			loadedPages.value.saved = result.page;
			hasNextMap.value.saved = result.hasNext;
			if (result.items.length) hasLoadedMoreMap.value.saved = true;
		} else {
			const result = await recipeApi.listDrafts({
				page: loadedPages.value[currentMode] + 1,
				pageSize: 20,
				keyword: keywordText.value || undefined
			});
			cachedItems.value[currentMode] = [...cachedItems.value[currentMode], ...result.items.map(toDraftItem)];
			loadedPages.value[currentMode] = result.page;
			hasNextMap.value[currentMode] = result.hasNext;
			if (result.items.length > 0) {
				hasLoadedMoreMap.value[currentMode] = true;
			}
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

function openItem(item: DisplayItem) {
	if ((deletingDraftId.value && deletingDraftId.value === item.id) || (deletingRecipeId.value && deletingRecipeId.value === item.id)) return;
	if (mode.value === "recipes") {
		void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.id))}&kind=my`);
		return;
	}
	if (mode.value === "saved") {
		const saved = item.raw as SavedInspirationSummary;
		void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(saved.sourceRecipeId))}&kind=inspiration&savedId=${encodeURIComponent(String(saved.saveId))}`);
		return;
	}
	void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?draftId=${encodeURIComponent(String(item.id))}`);
}

async function removeSaved(item: DisplayItem) {
	if (mode.value !== "saved" || removingSaveId.value) return;
	const saved = item.raw as SavedInspirationSummary;
	const confirmed = await uniPlatform.feedback.confirm({
		title: "移除收藏",
		content: `确定从私房菜移除“${item.title}”吗？`,
		confirmText: "移除",
		cancelText: "取消",
		maskClosable: true
	});
	if (!confirmed) return;
	removingSaveId.value = item.id;
	try {
		await recipeApi.removeSavedInspiration(saved.saveId, createOperationId());
		cachedItems.value.saved = cachedItems.value.saved.filter(current => current.id !== item.id);
		markRecipeHomeDirty(["saved"]);
		markRecipeManageDirty(["saved"]);
		syncModeLoadState("saved");
		await uniPlatform.feedback.toast({ title: "已从私房菜移除", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "移除失败", icon: "none" });
	} finally {
		removingSaveId.value = "";
	}
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
		meta: `${item.category?.name || "未分类"} · ${item.difficultyText || "未设置难度"} · ${item.durationText || "未设置时长"}`,
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

function toSavedItem(item: SavedInspirationSummary): DisplayItem {
	return {
		id: item.saveId,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		meta: `${item.owner.nickname ? `由${item.owner.nickname}整理` : "灵感菜谱"} · ${item.difficultyText || "未设置难度"} · ${item.durationText || "未设置时长"}`,
		updatedAt: item.savedAt,
		updatedAtText: `收藏于 ${formatDateTimeSecond(item.savedAt)}`,
		raw: item
	};
}
</script>

<style scoped lang="scss">
.list-nav,
.tabs {
	display: flex;
}

.list-nav {
	width: 100%;
	align-items: flex-start;
	gap: 18rpx;
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
	background: var(--color-support-action);
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

.list-shell {
	padding: 20rpx var(--space-page) calc(40rpx + env(safe-area-inset-bottom));
}

.list {
	display: flex;
	flex-direction: column;
	gap: var(--space-page);
}

.card {
	overflow: hidden;
	border-radius: var(--radius-xs);
	background: var(--material-card-bg);
	box-shadow: var(--material-card-shadow);
	-webkit-backdrop-filter: var(--material-card-filter);
	backdrop-filter: var(--material-card-filter);
}

:deep(.card .recipe-list-row__main) {
	padding: 20rpx 20rpx 20rpx 0;
}

:deep(.card .recipe-list-row__footer) {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 8rpx;
}

.card__action-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	gap: 16rpx;
}

.card__tail,
.card__delete {
	color: var(--color-text-secondary);
	font-size: 22rpx;
	line-height: 1.5;
}

.card__delete {
	color: var(--color-state-danger-text);
	flex: 0 0 auto;
	white-space: nowrap;
}

.card__delete--disabled {
	opacity: 0.56;
}

.card__tail {
	flex: 0 0 auto;
	white-space: nowrap;
}
</style>
