<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="菜谱管理">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后管理菜谱"
      description="这里查看我的已发布菜谱和草稿箱。"
      @success="handleLoginSuccess"
    />

    <template v-else>
      <view class="toolbar">
        <view class="tabs">
          <view class="tab" :class="{ 'tab--active': mode === 'recipes' }" @click="switchMode('recipes')">我的菜谱</view>
          <view class="tab" :class="{ 'tab--active': mode === 'drafts' }" @click="switchMode('drafts')">草稿箱</view>
        </view>
        <button class="toolbar__button" @click="createRecipe">新建菜谱</button>
      </view>

      <view class="search-row">
        <input
          v-model="keyword"
          class="search-row__input"
          placeholder="搜索菜名"
          confirm-type="search"
          @confirm="loadList"
        />
        <button class="search-row__button" @click="loadList">搜索</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadList">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <Empty
        v-else-if="!items.length"
        :title="mode === 'recipes' ? '还没有已发布菜谱' : '还没有草稿'"
        :description="mode === 'recipes' ? '先新建一份属于你的菜谱。' : '存草稿后会显示在这里。'"
      />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card" @click="openItem(item)">
          <view class="card__main">
            <text class="card__title">{{ item.title }}</text>
            <text class="card__meta">{{ item.meta }}</text>
          </view>
          <view class="card__side">
            <text class="card__tail">{{ item.updatedAt.slice(0, 10) }}</text>
            <text
              v-if="mode === 'drafts'"
              class="card__danger"
              :class="{ 'card__danger--disabled': deletingDraftId === item.id }"
              @click.stop="removeDraft(item)"
            >
              {{ deletingDraftId === item.id ? "删除中..." : "删除草稿" }}
            </text>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import type { UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary, type RecipeDraftSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type ListMode = "recipes" | "drafts";

interface DisplayItem {
	id: UUID;
	title: string;
	meta: string;
	updatedAt: string;
	raw: MyRecipeSummary | RecipeDraftSummary;
}

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const mode = ref<ListMode>("recipes");
const keyword = ref("");
const loading = ref(false);
const errorText = ref("");
const items = ref<DisplayItem[]>([]);
const deletingDraftId = ref<UUID | "">("");

onLoad((query) => {
	const rawMode = Array.isArray(query?.mode) ? query.mode[0] : query?.mode;
	mode.value = rawMode === "drafts" ? "drafts" : "recipes";
});

onShow(() => {
	if (!sessionStore.isLoggedIn) return;
	void loadList();
});

function handleLoginSuccess() {
	void loadList();
}

function switchMode(nextMode: ListMode) {
	if (mode.value === nextMode) return;
	mode.value = nextMode;
	void loadList();
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
				keyword: keyword.value.trim() || undefined
			});
			items.value = result.items.map(toRecipeItem);
		} else {
			const result = await recipeApi.listDrafts({
				page: 1,
				pageSize: 50,
				keyword: keyword.value.trim() || undefined
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

function openItem(item: DisplayItem) {
	if (deletingDraftId.value && deletingDraftId.value === item.id) return;
	if (mode.value === "recipes") {
		void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(item.id))}&kind=my`);
		return;
	}
	void uniPlatform.navigation.navigateTo(`/pages_recipe/edit/index?draftId=${encodeURIComponent(String(item.id))}`);
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
		meta: `${item.category.name} · ${difficultyText} · ${durationText}`,
		updatedAt: item.updatedAt,
		raw: item
	};
}

function toDraftItem(item: RecipeDraftSummary): DisplayItem {
	return {
		id: item.id,
		title: item.title || "未命名草稿",
		meta: `${item.category?.name ?? "未选分类"} · 草稿版本 ${item.version}`,
		updatedAt: item.updatedAt,
		raw: item
	};
}
</script>

<style scoped lang="scss">
.toolbar,
.search-row,
.card,
.tabs {
	display: flex;
	gap: var(--space-sm);
}

.toolbar {
	align-items: center;
	justify-content: space-between;
}

.toolbar__button,
.search-row__button {
	border-radius: var(--radius-md);
	background: var(--color-primary);
	color: var(--color-primary-foreground);
}

.tabs {
	flex: 1;
}

.tab {
	padding: 16rpx 26rpx;
	border-radius: var(--radius-pill);
	background: var(--color-surface-muted);
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
}

.tab--active {
	background: var(--color-primary-soft);
	color: var(--color-primary);
}

.search-row {
	margin-top: var(--space-md);
}

.search-row__input {
	flex: 1;
	min-width: 0;
	padding: 20rpx 24rpx;
	border: 1rpx solid var(--color-border);
	border-radius: var(--radius-md);
	background: var(--color-surface);
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
	align-items: center;
	justify-content: space-between;
	padding: var(--space-md);
	border: 1rpx solid var(--color-border);
	border-radius: var(--radius-md);
	background: var(--color-surface);
}

.card + .card {
	margin-top: var(--space-sm);
}

.card__main {
	flex: 1;
	min-width: 0;
}

.card__side {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 12rpx;
	margin-left: var(--space-sm);
}

.card__title,
.card__meta {
	display: block;
}

.card__title {
	color: var(--color-text);
	font-size: var(--font-size-lg);
	font-weight: var(--font-weight-semibold);
}

.card__meta,
.card__tail {
	color: var(--color-text-secondary);
	font-size: var(--font-size-sm);
}

.card__meta {
	margin-top: 8rpx;
	line-height: 1.6;
}

.card__danger {
	color: var(--color-danger-text);
	font-size: var(--font-size-sm);
	line-height: 1.4;
}

.card__danger--disabled {
	opacity: 0.56;
}
</style>
