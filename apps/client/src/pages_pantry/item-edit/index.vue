<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="编辑食材">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后维护冰箱食材" description="冰箱条目只归你本人所有。" />

    <template v-else>
      <view class="section">
        <text class="section__title">新增冰箱条目</text>
        <input v-model="name" class="input" placeholder="名称，例如 鸡蛋" />
        <input v-model="quantityText" class="input" placeholder="数量，例如 6 个" />
        <input v-model="note" class="input" placeholder="备注，例如 本周先吃" />
        <button class="primary" :disabled="submitting || !name.trim()" @click="createItem">保存食材</button>
      </view>

      <view v-if="errorText" class="notice" @click="loadItems">{{ errorText }}</view>
      <view v-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!items.length" title="还没有冰箱条目" description="先把已有食材记下来。" />

      <view v-else class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card__main">
            <text class="card__title">{{ item.name }}</text>
            <text class="card__meta">{{ item.quantityText || "未填数量" }} · {{ item.available ? "可用" : "已扣减" }}</text>
          </view>
          <view class="card__actions">
            <button v-if="item.available" class="secondary" :disabled="submitting" @click="consumeItem(item.id)">扣减</button>
            <button class="secondary" :disabled="submitting" @click="fillForm(item)">回填</button>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import Login from "@/components/Login/Login.vue";
import { fridgeApi, type FridgeItemSummary } from "../apis/fridge";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const items = ref<FridgeItemSummary[]>([]);
const editingId = ref<UUID | "">("");
const name = ref("");
const quantityText = ref("");
const note = ref("");

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadItems();
});

async function loadItems() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await fridgeApi.list();
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "冰箱条目加载失败";
  } finally {
    loading.value = false;
  }
}

async function createItem() {
  if (submitting.value || !name.value.trim()) return;
  submitting.value = true;
  try {
    if (editingId.value) {
      await fridgeApi.update(editingId.value, {
        operationId: createOperationId(),
        name: name.value,
        quantityText: quantityText.value,
        note: note.value
      });
    } else {
      await fridgeApi.create({
        operationId: createOperationId(),
        name: name.value,
        quantityText: quantityText.value,
        note: note.value
      });
    }
    resetForm();
    await uniPlatform.feedback.toast({ title: "已保存", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function consumeItem(itemId: UUID) {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await fridgeApi.consume([itemId], createOperationId());
    await uniPlatform.feedback.toast({ title: "已扣减", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "扣减失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function fillForm(item: FridgeItemSummary) {
  editingId.value = item.id;
  name.value = item.name;
  quantityText.value = item.quantityText ?? "";
  note.value = item.note ?? "";
}

function resetForm() {
  editingId.value = "";
  name.value = "";
  quantityText.value = "";
  note.value = "";
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

.primary,
.secondary {
  margin-top: var(--space-sm);
  border-radius: var(--radius-md);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.list {
  margin-top: var(--space-md);
}

.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
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

.card__actions {
  display: flex;
  gap: var(--space-sm);
}
</style>
