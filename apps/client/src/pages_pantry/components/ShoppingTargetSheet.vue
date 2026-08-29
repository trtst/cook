<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    :panel-style="panelStyle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view v-if="metaTitle || metaText" class="shopping-target-sheet__meta">
      <text v-if="metaTitle" class="shopping-target-sheet__meta-title">{{ metaTitle }}</text>
      <text v-if="metaText" class="shopping-target-sheet__meta-text">{{ metaText }}</text>
    </view>

    <view class="shopping-target-sheet__section">
      <view class="shopping-target-sheet__head">
        <text class="shopping-target-sheet__title">{{ listTitle }}</text>
        <text v-if="showCreateAction" class="shopping-target-sheet__action" @click="emit('toggleCreate')">
          {{ createMode ? cancelCreateText : createActionText }}
        </text>
      </view>

      <view v-if="createMode && !showCreateOption" class="shopping-target-sheet__create-row">
        <input
          v-model="createNameModel"
          class="shopping-target-sheet__input shopping-target-sheet__input--grow"
          :maxlength="createMaxlength"
          :placeholder="createPlaceholder"
        />
        <view
          class="shopping-target-sheet__create-button"
          :class="{ 'shopping-target-sheet__create-button--disabled': createDisabled }"
          @click="handleCreateClick"
        >
          {{ creating ? createLoadingText : createButtonText }}
        </view>
      </view>

      <view v-if="items.length" class="shopping-target-sheet__option-list">
        <view
          v-for="item in items"
          :key="item.id"
          class="shopping-target-sheet__option"
          :class="{
            'shopping-target-sheet__option--active': selectedId === item.id && (!createMode || !hideSelectedStateWhenCreating)
          }"
          @click="emit('select', item.id)"
        >
          <text class="shopping-target-sheet__option-title">{{ item.name }}</text>
          <text class="shopping-target-sheet__option-meta">
            剩余 {{ Math.max(item.progressTotalCount - item.progressDoneCount, 0) }} 项待处理
          </text>
        </view>
      </view>

      <text v-else-if="emptyText" class="shopping-target-sheet__empty">{{ emptyText }}</text>

      <view
        v-if="showCreateOption"
        class="shopping-target-sheet__option"
        :class="{ 'shopping-target-sheet__option--active': createMode }"
        @click="emit('openCreate')"
      >
        <text class="shopping-target-sheet__option-title">{{ createOptionTitle }}</text>
        <text v-if="createOptionText" class="shopping-target-sheet__option-meta">{{ createOptionText }}</text>
      </view>

      <view v-if="createMode && showCreateOption" class="shopping-target-sheet__create-row shopping-target-sheet__create-row--after-option">
        <input
          v-model="createNameModel"
          class="shopping-target-sheet__input shopping-target-sheet__input--grow"
          :maxlength="createMaxlength"
          :placeholder="createPlaceholder"
        />
        <view
          v-if="showCreateButton"
          class="shopping-target-sheet__create-button"
          :class="{ 'shopping-target-sheet__create-button--disabled': createDisabled }"
          @click="handleCreateClick"
        >
          {{ creating ? createLoadingText : createButtonText }}
        </view>
      </view>
    </view>

    <slot />

    <template #footer>
      <slot name="footer" />
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, type StyleValue } from "vue";
import type { UUID } from "@/apis/http";
import SheetShell from "@/components/Sheet/SheetShell.vue";

type ShoppingTargetOption = {
  id: UUID;
  name: string;
  progressDoneCount: number;
  progressTotalCount: number;
};

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  subtitle?: string;
  panelStyle?: StyleValue;
  metaTitle?: string;
  metaText?: string;
  listTitle?: string;
  createMode: boolean;
  creating: boolean;
  createDisabled: boolean;
  createName: string;
  items: ShoppingTargetOption[];
  selectedId: UUID | "";
  showCreateAction?: boolean;
  showCreateOption?: boolean;
  showCreateButton?: boolean;
  createOptionTitle?: string;
  createOptionText?: string;
  hideSelectedStateWhenCreating?: boolean;
  emptyText?: string;
  createActionText?: string;
  cancelCreateText?: string;
  createButtonText?: string;
  createLoadingText?: string;
  createPlaceholder?: string;
  createMaxlength?: number;
}>(), {
  title: "加入采购清单",
  subtitle: "先选一张当前要维护的采购清单。",
  panelStyle: undefined,
  metaTitle: "",
  metaText: "",
  listTitle: "目标清单",
  showCreateAction: true,
  showCreateOption: false,
  showCreateButton: true,
  createOptionTitle: "新建采购清单",
  createOptionText: "",
  hideSelectedStateWhenCreating: false,
  emptyText: "",
  createActionText: "创建清单",
  cancelCreateText: "取消创建",
  createButtonText: "创建",
  createLoadingText: "创建中...",
  createPlaceholder: "输入新清单名",
  createMaxlength: 20
});

const emit = defineEmits<{
  close: [];
  afterClose: [];
  toggleCreate: [];
  openCreate: [];
  create: [];
  select: [listId: UUID];
  "update:createName": [value: string];
}>();

const createNameModel = computed({
  get: () => props.createName,
  set: (value: string) => emit("update:createName", value)
});

function handleCreateClick() {
  if (props.createDisabled) return;
  emit("create");
}
</script>

<style scoped lang="scss">
.shopping-target-sheet__meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface-soft);
}

.shopping-target-sheet__meta-title,
.shopping-target-sheet__meta-text,
.shopping-target-sheet__option-title,
.shopping-target-sheet__option-meta,
.shopping-target-sheet__empty {
  display: block;
}

.shopping-target-sheet__meta-title,
.shopping-target-sheet__title,
.shopping-target-sheet__option-title {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.shopping-target-sheet__meta-text,
.shopping-target-sheet__option-meta,
.shopping-target-sheet__empty {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.shopping-target-sheet__section {
  margin-top: 24rpx;
}

.shopping-target-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 14rpx;
}

.shopping-target-sheet__action,
.shopping-target-sheet__create-button {
  color: var(--color-support-action);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.shopping-target-sheet__create-row {
  display: flex;
  align-items: stretch;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.shopping-target-sheet__input {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 88rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.shopping-target-sheet__input--grow {
  flex: 1;
  min-width: 0;
}

.shopping-target-sheet__create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 144rpx;
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-xs);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.shopping-target-sheet__create-button--disabled {
  opacity: 0.4;
}

.shopping-target-sheet__option-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.shopping-target-sheet__option {
  padding: 22rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.shopping-target-sheet__option--active {
  background: var(--color-tag-primary-bg);
  box-shadow:
    var(--material-card-shadow),
    inset 0 0 0 1rpx var(--color-border-active);
}

.shopping-target-sheet__option-meta {
  margin-top: 8rpx;
}

.shopping-target-sheet__create-row--after-option {
  margin-top: 14rpx;
  margin-bottom: 0;
}
</style>
