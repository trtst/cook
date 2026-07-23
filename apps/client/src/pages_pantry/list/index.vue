<template>
  <Layout title="购物清单">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看购物清单" description="购物清单只归你本人所有。" />

    <template v-else>
      <view class="section">
        <text class="section__title">手动加一项</text>
        <input v-model="name" class="input" placeholder="名称，例如 生抽" />
        <input v-model="quantityText" class="input" placeholder="数量，例如 1 瓶" />
        <input v-model="note" class="input" placeholder="备注，例如 饭局补货" />
        <button class="primary" :disabled="submitting || !name.trim()" @click="createItem">加入清单</button>
      </view>

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
      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="清单为空" description="你可以手动添加，也可以从饭局缺口生成。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card__main">
            <text class="card__title">{{ item.name }}</text>
            <text class="card__meta">{{ item.quantityText || "未填数量" }} · {{ item.sourceType }}</text>
          </view>
          <view class="card__actions">
            <button
              v-if="item.status === 'OPEN'"
              class="secondary"
              :disabled="submitting"
              @click="updateStatus(item.id, 'BOUGHT')"
            >
              买好了
            </button>
            <button class="danger" :disabled="submitting" @click="updateStatus(item.id, 'DELETED')">删除</button>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { shoppingApi, type ShoppingItemSummary } from "@/apis/shopping";
import Empty from "@/components/Empty/Empty.vue";
import Login from "@/components/Login/Login.vue";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const items = ref<ShoppingItemSummary[]>([]);
const status = ref<"OPEN" | "BOUGHT" | "DELETED">("OPEN");
const name = ref("");
const quantityText = ref("");
const note = ref("");

const filters = [
  { value: "OPEN" as const, label: "待买" },
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
    errorText.value = error instanceof Error ? error.message : "购物清单加载失败";
  } finally {
    loading.value = false;
  }
}

function changeStatus(next: "OPEN" | "BOUGHT" | "DELETED") {
  if (status.value === next) return;
  status.value = next;
  void loadItems();
}

async function createItem() {
  if (submitting.value || !name.value.trim()) return;
  submitting.value = true;
  try {
    await shoppingApi.create({
      operationId: createOperationId(),
      name: name.value,
      quantityText: quantityText.value,
      note: note.value
    });
    name.value = "";
    quantityText.value = "";
    note.value = "";
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function updateStatus(itemId: string, nextStatus: "BOUGHT" | "DELETED") {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await shoppingApi.updateStatus(itemId, createOperationId(), nextStatus);
    await uniPlatform.feedback.toast({ title: "已更新", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "更新失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.section,
.notice,
.card {
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.section__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.input {
  width: 100%;
  margin-top: var(--space-sm);
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.primary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.filter-row,
.card,
.card__actions {
  display: flex;
  gap: var(--space-sm);
}

.filter-row {
  margin-top: var(--space-md);
  flex-wrap: wrap;
}

.filter-chip {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.filter-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.list {
  margin-top: var(--space-md);
}

.card {
  align-items: center;
  justify-content: space-between;
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
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.card__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.secondary,
.danger {
  border-radius: var(--radius-md);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.danger {
  background: var(--color-danger);
  color: #fff;
}
</style>
