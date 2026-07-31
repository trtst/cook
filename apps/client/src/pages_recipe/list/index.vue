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

      <view v-if="errorText" class="notice" @click="loadList">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <RecipeEmptyState
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
              <text class="card__cover-text font-black">{{ mode === "drafts" ? "草稿" : "封面" }}</text>
            </view>
          </view>
          <view class="card__body">
            <text class="card__title">{{ item.title }}</text>
            <view class="card__foot">
              <text class="card__meta">{{ item.meta }}</text>
              <view class="card__action-row">
                <text v-if="mode === 'recipes'" class="card__tail">{{ item.updatedAt.slice(0, 10) }}</text>
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
import Layout from "@/components/Layout/Layout.vue";
import RecipeEmptyState from "@/components/Recipe/RecipeEmptyState.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type ListMode = "recipes" | "drafts";

interface DisplayItem {
	id: UUID;
	title: string;
	coverImageUrl: string | null;
	meta: string;
	updatedAt: string;
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
const mode = ref<ListMode>("recipes");
const keyword = ref("");
const loading = ref(false);
const errorText = ref("");
const items = ref<DisplayItem[]>([]);
const deletingDraftId = ref<UUID | "">("");
const deletingRecipeId = ref<UUID | "">("");
const keywordText = computed(() => keyword.value.trim());

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
		void loadList();
	}
});

function handleLoginSuccess() {
	void loadList();
}

function switchMode(nextMode: ListMode) {
	if (mode.value === nextMode) return;
	mode.value = nextMode;
	void loadList();
}

function clearKeyword() {
	if (!keyword.value) return;
	keyword.value = "";
}

async function loadList() {
	if (!sessionStore.isLoggedIn || loading.value) return;
	loading.value = true;
	errorText.value = "";
	try {
		if (mode.value === "recipes") {
			const result = await recipeApi.listMyRecipes({
				page: 1,
				pageSize: 50,
				keyword: keywordText.value || undefined
			});
			items.value = result.items.map(toRecipeItem);
		} else {
			const result = await recipeApi.listDrafts({
				page: 1,
				pageSize: 50,
				keyword: keywordText.value || undefined
			});
			items.value = result.items.map(toDraftItem);
		}
	} catch (error) {
		errorText.value = error instanceof Error ? error.message : "列表加载失败";
	} finally {
		loading.value = false;
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
		items.value = items.value.filter(current => current.id !== item.id);
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
		items.value = items.value.filter(current => current.id !== item.id);
		await uniPlatform.feedback.toast({ title: "草稿已删除", icon: "success" });
	} catch (error) {
		await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "删除失败", icon: "none" });
	} finally {
		deletingDraftId.value = "";
	}
}

function toRecipeItem(item: MyRecipeSummary): DisplayItem {
	const difficultyText =
		item.difficulty === "BEGINNER"
			? "新手友好"
			: item.difficulty === "EASY"
				? "轻松上手"
				: item.difficulty === "SKILLED"
					? "需要经验"
					: item.difficulty === "CHALLENGING"
						? "进阶挑战"
						: "未设置难度";
	const durationText =
		item.duration === "WITHIN_15"
			? "15分钟内"
			: item.duration === "BETWEEN_15_30"
				? "15~30分钟"
				: item.duration === "BETWEEN_30_60"
					? "30~60分钟"
					: item.duration === "OVER_60"
						? "1小时以上"
						: "未设置时长";
	return {
		id: item.id,
		title: item.title,
		coverImageUrl: resolveCoverImageUrl(item.coverImageUrl),
		meta: `${item.category.name} · ${difficultyText} · ${durationText}`,
		updatedAt: item.updatedAt,
		raw: item
	};
}

function toDraftItem(item: RecipeDraftSummary): DisplayItem {
	return {
		id: item.id,
		title: item.title || "未命名草稿",
		coverImageUrl: null,
		meta: `${item.category?.name ?? "未选分类"} · 草稿版本 ${item.version}`,
		updatedAt: item.updatedAt,
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
	justify-content: center;
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
	margin-top: 12rpx;
}

.list-page {
	min-height: 100vh;
	padding: 10rpx var(--space-page) calc(40rpx + env(safe-area-inset-bottom));
}

.notice {
	margin-top: var(--space-md);
	padding: var(--space-md);
	border-radius: var(--radius-md);
	background: var(--color-surface-muted);
	color: var(--color-text-secondary);
}

.list {
	margin-top: var(--space-md);
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
