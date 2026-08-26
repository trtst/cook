<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view class="sheet-section">
      <text class="sheet-section__title">{{ listTitle }}</text>
      <view v-if="loading" class="shopping-sheet__state">加载中...</view>
      <view v-else-if="errorText" class="shopping-sheet__state shopping-sheet__state--error" @click="emit('retry')">
        {{ errorText }}
      </view>
      <view v-else-if="items.length" class="shopping-list-grid">
        <view
          v-for="item in items"
          :key="item.id"
          class="shopping-list-option"
          :class="{ 'shopping-list-option--active': selectedId === item.id }"
          @click="selectedIdModel = item.id"
        >
          <text class="shopping-list-option__title">{{ item.name }}</text>
          <text class="shopping-list-option__meta">{{ item.progressDoneCount }}/{{ item.progressTotalCount }} · {{ item.memberCount }} 人</text>
        </view>
      </view>
      <text v-else class="sheet-section__hint">{{ emptyText }}</text>
    </view>

    <view class="sheet-section">
      <text class="sheet-section__title">{{ createTitle }}</text>
      <view class="shopping-create">
        <input
          v-model="createNameModel"
          class="shopping-create__input"
          maxlength="30"
          :placeholder="createPlaceholder"
        />
        <view class="shopping-create__button" @click="emit('create')">新建</view>
      </view>
    </view>

    <template #footer>
      <view class="sheet-actions">
        <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="emit('close')">
          {{ cancelText }}
        </button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :disabled="submitting || !selectedId"
          @click="emit('confirm')"
        >
          {{ submitting ? confirmLoadingText : confirmText }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UUID } from "@/apis/http";
import SheetShell from "@/components/Sheet/SheetShell.vue";

type ShoppingListOption = {
  id: UUID;
  name: string;
  memberCount: number;
  progressDoneCount: number;
  progressTotalCount: number;
};

const props = withDefaults(defineProps<{
  visible: boolean;
  loading: boolean;
  errorText?: string;
  items: ShoppingListOption[];
  selectedId: UUID | "";
  createName: string;
  submitting: boolean;
  title?: string;
  subtitle?: string;
  listTitle?: string;
  createTitle?: string;
  emptyText?: string;
  createPlaceholder?: string;
  cancelText?: string;
  confirmText?: string;
  confirmLoadingText?: string;
}>(), {
  errorText: "",
  title: "加入采购清单",
  subtitle: "先选一张采购中的清单，也可以现场新建空白清单。",
  listTitle: "采购中清单",
  createTitle: "新建空白清单",
  emptyText: "还没有采购中的清单，先新建一张空白清单。",
  createPlaceholder: "清单名可不填，系统会自动生成",
  cancelText: "取消",
  confirmText: "确认加入",
  confirmLoadingText: "加入中..."
});

const emit = defineEmits<{
  close: [];
  afterClose: [];
  retry: [];
  create: [];
  confirm: [];
  "update:selectedId": [value: UUID | ""];
  "update:createName": [value: string];
}>();

const selectedIdModel = computed({
  get: () => props.selectedId,
  set: (value: UUID | "") => emit("update:selectedId", value)
});

const createNameModel = computed({
  get: () => props.createName,
  set: (value: string) => emit("update:createName", value)
});
</script>

<style scoped lang="scss">
.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__hint {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.shopping-sheet__state {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.shopping-sheet__state--error {
  color: var(--color-danger);
}

.shopping-list-grid {
  display: grid;
  gap: 16rpx;
}

.shopping-list-option {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
}

.shopping-list-option--active {
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 2rpx color-mix(in srgb, var(--color-primary) 24%, transparent);
}

.shopping-list-option--active .shopping-list-option__title {
  color: var(--color-primary);
}

.shopping-list-option__title,
.shopping-list-option__meta {
  display: block;
}

.shopping-list-option__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.shopping-list-option__meta {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.shopping-create {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.shopping-create__input {
  flex: 1;
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 28rpx;
}

.shopping-create__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 124rpx;
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions {
  display: flex;
  gap: 18rpx;
}

.sheet-actions__button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--cancel {
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}
</style>
