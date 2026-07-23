<template>
  <Layout title="系统菜谱">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后浏览系统菜谱" description="可查看详情并决定是否导入。" />

    <template v-else>
      <view class="toolbar">
        <input v-model="keyword" class="toolbar__input" placeholder="搜菜名或食材" confirm-type="search" @confirm="loadList" />
        <button class="toolbar__button" @click="loadList">搜索</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadList">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="暂无系统菜谱" description="搜索结果为空。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card" @click="openDetail(item.id)">
          <text class="card__title">{{ item.title }}</text>
          <text class="card__meta">{{ item.updatedAt.slice(0, 10) }}</text>
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
const keyword = ref("");
const loading = ref(false);
const errorText = ref("");
const items = ref<RecipeSummary[]>([]);

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
      scope: "system",
      keyword: keyword.value.trim() || undefined
    });
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "系统菜谱加载失败";
  } finally {
    loading.value = false;
  }
}

function openDetail(recipeId: string) {
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(recipeId)}`);
}
</script>

<style scoped lang="scss">
.toolbar {
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

.toolbar__button {
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.notice {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.list {
  margin-top: var(--space-md);
}

.card {
  padding: var(--space-md);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.card + .card {
  margin-top: var(--space-sm);
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
</style>
