<template>
  <Layout title="菜谱列表">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看个人菜谱"
      description="第一版搜索只覆盖我的个人菜谱和系统菜谱。"
    />

    <template v-else>
      <view class="toolbar">
        <input v-model="keyword" class="toolbar__input" placeholder="搜菜名或食材" confirm-type="search" @confirm="loadList" />
        <button class="toolbar__button" @click="loadList">搜索</button>
      </view>

      <view class="scope-row">
        <view
          v-for="item in scopes"
          :key="item.value"
          class="scope-chip"
          :class="{ 'scope-chip--active': scope === item.value }"
          @click="handleScopeChange(item.value)"
        >
          {{ item.label }}
        </view>
      </view>

      <view class="action-row">
        <button class="action-row__button" @click="navigateTo('/pages_recipe/edit/index')">新建菜谱</button>
        <button class="action-row__button action-row__button--light" @click="navigateTo('/pages_recipe/import/index')">导入菜谱</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadList">{{ errorText }}</view>

      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="暂无菜谱" description="先新建自己的菜谱，或从系统菜谱导入。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card" @click="openDetail(item.id)">
          <view class="card__main">
            <text class="card__title">{{ item.title }}</text>
            <text class="card__meta">{{ item.ownerType === 'SYSTEM' ? '系统菜谱' : '我的菜谱' }} · {{ formatTime(item.updatedAt) }}</text>
          </view>
          <text class="card__tag">{{ item.isCustomized ? "已修改" : "原样" }}</text>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { recipeApi, type RecipeSummary } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";

const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const keyword = ref("");
const scope = ref<"mine" | "all" | "system">("all");
const items = ref<RecipeSummary[]>([]);

const scopes = [
  { value: "all" as const, label: "我的 + 系统" },
  { value: "mine" as const, label: "只看我的" },
  { value: "system" as const, label: "只看系统" }
];

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadList();
});

async function loadList() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await recipeApi.list({
      page: 1,
      pageSize: 50,
      keyword: keyword.value.trim() || undefined,
      scope: scope.value
    });
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "菜谱加载失败，点击重试";
  } finally {
    loading.value = false;
  }
}

function handleScopeChange(value: "mine" | "all" | "system") {
  if (scope.value === value) return;
  scope.value = value;
  void loadList();
}

function openDetail(recipeId: string) {
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(recipeId)}`);
}

function navigateTo(url: string) {
  void uniPlatform.navigation.navigateTo(url);
}

function formatTime(value: string) {
  return value.slice(0, 10);
}
</script>

<style scoped lang="scss">
.toolbar,
.scope-row,
.action-row,
.card {
  display: flex;
  gap: var(--space-sm);
}

.toolbar__input {
  flex: 1;
  min-width: 0;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.toolbar__button,
.action-row__button {
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.action-row {
  margin-top: var(--space-sm);
}

.action-row__button {
  flex: 1;
}

.action-row__button--light {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1rpx solid var(--color-border);
}

.scope-row {
  margin-top: var(--space-sm);
  flex-wrap: wrap;
}

.scope-chip {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.scope-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
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

.card__title,
.card__meta {
  display: block;
}

.card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.card__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.card__tag {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}
</style>
