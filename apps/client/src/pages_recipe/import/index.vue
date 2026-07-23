<template>
  <Layout title="导入菜谱">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后导入系统菜谱" description="首版只开放系统菜谱广场导入。" />

    <template v-else>
      <view class="toolbar">
        <input v-model="keyword" class="toolbar__input" placeholder="搜菜名或食材" confirm-type="search" @confirm="loadList" />
        <button class="toolbar__button" @click="loadList">搜索</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadList">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="暂无系统菜谱" description="稍后再来看看。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card__main" @click="openDetail(item.id)">
            <text class="card__title">{{ item.title }}</text>
            <text class="card__meta">{{ item.updatedAt.slice(0, 10) }}</text>
          </view>
          <button class="card__button" :disabled="submittingId === item.id" @click="handleImport(item.id)">导入</button>
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
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const loading = ref(false);
const keyword = ref("");
const errorText = ref("");
const items = ref<RecipeSummary[]>([]);
const submittingId = ref("");

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

async function handleImport(recipeId: string) {
  if (submittingId.value) return;
  submittingId.value = recipeId;
  try {
    const result = await recipeApi.importRecipe(recipeId, createOperationId());
    await uniPlatform.feedback.toast({
      title: result.reusedExisting ? "已打开已有入口" : "导入成功",
      icon: "success"
    });
    void uniPlatform.navigation.redirectTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(result.recipe.id)}`);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "导入失败", icon: "none" });
  } finally {
    submittingId.value = "";
  }
}
</script>

<style scoped lang="scss">
.toolbar,
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
.card__button {
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
  align-items: center;
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
