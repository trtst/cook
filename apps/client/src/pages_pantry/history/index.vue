<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="采购记录">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看采购记录" description="采购记录只保留你自己的已完成条目。" />

    <template v-else>
      <view class="filter-row">
        <view
          v-for="item in filters"
          :key="item.value"
          class="filter-chip"
          :class="{ 'filter-chip--active': status === item.value }"
          @click="changeStatus(item.value)"
        >
          {{ item.label }}
        </view>
      </view>

      <view v-if="errorText" class="notice" @click="loadItems">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="还没有记录" description="先去购物清单里完成一次采购。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <text class="card__title">{{ item.name }}</text>
          <text class="card__meta">{{ item.quantityText || "未填数量" }} · {{ item.sourceType }}</text>
          <text class="card__meta">{{ item.updatedAt }}</text>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { shoppingApi, type ShoppingItemSummary } from "../apis/shopping";
import { useSessionStore } from "@/stores/session";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const status = ref<"BOUGHT" | "DELETED">("BOUGHT");
const loading = ref(false);
const errorText = ref("");
const items = ref<ShoppingItemSummary[]>([]);

const filters = [
  { value: "BOUGHT" as const, label: "已买" },
  { value: "DELETED" as const, label: "已删" }
];

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadItems();
});

async function loadItems() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await shoppingApi.list(status.value);
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "采购记录加载失败";
  } finally {
    loading.value = false;
  }
}

function changeStatus(next: "BOUGHT" | "DELETED") {
  if (status.value === next) return;
  status.value = next;
  void loadItems();
}
</script>

<style scoped lang="scss">
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.filter-chip {
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.filter-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.notice,
.card {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.list {
  margin-top: var(--space-md);
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
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.card__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}
</style>
