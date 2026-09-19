<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    :body-scroll="false"
    :panel-style="{ maxHeight: '62vh' }"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view class="shopping-sheet">
      <view class="shopping-create-section">
        <view class="shopping-create-section__head">
          <text class="sheet-section__title">{{ listTitle }}</text>
          <view class="sheet-section__action" @click="toggleCreateForm">
            {{ showCreateForm ? "取消" : createTitle }}
          </view>
        </view>
        <view v-if="showCreateForm" class="shopping-create">
          <input
            v-model="createNameModel"
            class="shopping-create__input"
            maxlength="30"
            :placeholder="createPlaceholder"
          />
          <button
            class="shopping-create__button"
            :class="{ 'shopping-create__button--disabled': !canCreate }"
            @click="handleCreate"
          >
            新建
          </button>
        </view>
      </view>

      <view class="sheet-section shopping-list-section">
        <view v-if="loading" class="shopping-sheet__state">加载中...</view>
        <view v-else-if="errorText" class="shopping-sheet__state shopping-sheet__state--error" @click="emit('retry')">
          {{ errorText }}
        </view>
        <view v-else-if="items.length" class="shopping-list-grid">
          <view
            v-for="row in listRows"
            :key="row.key"
            class="shopping-list-option"
            :class="{ 'shopping-list-option--active': row.selected }"
            @click="selectedIdModel = row.item.id"
          >
            <text class="shopping-list-option__title">{{ row.item.name }}</text>
            <text class="shopping-list-option__meta">{{ shoppingListMetaText(row.item) }}</text>
          </view>
        </view>
        <text v-else class="sheet-section__hint">{{ emptyText }}</text>
      </view>
    </view>

    <template #footer>
      <view class="sheet-actions">
        <button
          class="sheet-actions__button sheet-actions__button--cancel"
          :class="{ 'sheet-actions__button--disabled': submitting }"
          @click="handleClose"
        >
          {{ cancelText }}
        </button>
        <button
          class="sheet-actions__button sheet-actions__button--confirm"
          :class="{ 'sheet-actions__button--disabled': submitting || !selectedId }"
          @click="handleConfirm"
        >
          {{ submitting ? confirmLoadingText : confirmText }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { shoppingListMetaText, shoppingListRows } from "./shopping-list-meta";

type ShoppingListOption = {
  id: UUID;
  name: string;
  progressDoneCount: number;
  progressTotalCount: number;
  updatedAt: string;
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
const listRows = computed(() => shoppingListRows(props.items, props.selectedId));
const canCreate = computed(() => !props.submitting);
const showCreateForm = ref(false);

watch(
  () => props.visible,
  visible => {
    if (!visible) return;
    showCreateForm.value = false;
  }
);

function toggleCreateForm() {
  showCreateForm.value = !showCreateForm.value;
  if (!showCreateForm.value) createNameModel.value = "";
}

function handleCreate() {
  if (!canCreate.value) return;
  emit("create");
}

function handleClose() {
  if (props.submitting) return;
  emit("close");
}

function handleConfirm() {
  if (props.submitting || !props.selectedId) return;
  emit("confirm");
}
</script>

<style scoped lang="scss">
.shopping-sheet {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.shopping-create-section {
  flex: 0 0 auto;
  padding: 24rpx 0;
}

.shopping-create-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.shopping-list-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__action {
  flex: 0 0 auto;
  color: var(--color-tag-primary-text);
  font-size: 26rpx;
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
  color: var(--color-state-danger-text);
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
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.shopping-list-option--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 2rpx var(--color-border-active);
}

.shopping-list-option--active .shopping-list-option__title {
  color: var(--color-tag-primary-text);
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
  height: 80rpx;
  line-height: 1;
  padding: 0 28rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  color: var(--color-text);
  font-size: 28rpx;
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.shopping-create__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 124rpx;
  height: 80rpx;
  border: 0;
  line-height: 1;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.shopping-create__button::after {
  border: 0;
}

.shopping-create__button--disabled {
  opacity: 0.8;
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
  height: 90rpx;
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
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.sheet-actions__button--disabled {
  opacity: 0.46;
}
</style>
