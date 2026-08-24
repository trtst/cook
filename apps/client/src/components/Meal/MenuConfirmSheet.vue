<template>
  <SheetShell
    :visible="visible"
    title="确认菜单"
    :subtitle="subtitle"
    @close="emit('close')"
  >
    <view class="menu-confirm-sheet">
      <view class="menu-confirm-sheet__summary">
        <text class="menu-confirm-sheet__summary-title">{{ summaryTitle }}</text>
        <text class="menu-confirm-sheet__summary-text">{{ summaryText }}</text>
      </view>

      <view v-if="loading" class="menu-confirm-sheet__state">正在按当前菜单刷新缺口...</view>

      <view v-else-if="items.length" class="menu-confirm-sheet__list">
        <view v-for="item in items" :key="item.key" class="menu-confirm-sheet__item">
          <view class="menu-confirm-sheet__item-main">
            <text class="menu-confirm-sheet__item-name">{{ item.name }}</text>
            <text class="menu-confirm-sheet__item-meta">{{ item.quantityText || "未填数量" }}</text>
          </view>
          <text v-if="item.recipeTitles.length" class="menu-confirm-sheet__item-recipes">{{ item.recipeTitles.join(" · ") }}</text>
        </view>
      </view>

      <view v-else class="menu-confirm-sheet__state menu-confirm-sheet__state--empty">{{ emptyText }}</view>

      <text class="menu-confirm-sheet__tip">确认菜单只会固定这顿吃什么，不会同步确认食材或写入采购清单。</text>
    </view>

    <template #footer>
      <view class="menu-confirm-sheet__actions">
        <button class="menu-confirm-sheet__button menu-confirm-sheet__button--cancel" :disabled="submitting" @click="emit('close')">
          返回改菜单
        </button>
        <button class="menu-confirm-sheet__button menu-confirm-sheet__button--confirm" :disabled="submitting || loading" @click="emit('confirm')">
          {{ submitting ? "确认中..." : "确认菜单" }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import SheetShell from "@/components/Sheet/SheetShell.vue";

type MenuConfirmItem = {
  key: string;
  name: string;
  quantityText: string | null;
  recipeTitles: string[];
};

defineProps<{
  visible: boolean;
  subtitle: string;
  summaryTitle: string;
  summaryText: string;
  loading: boolean;
  items: MenuConfirmItem[];
  emptyText: string;
  submitting: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<style scoped lang="scss">
.menu-confirm-sheet {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.menu-confirm-sheet__summary,
.menu-confirm-sheet__item {
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: rgba(255, 249, 238, 0.96);
}

.menu-confirm-sheet__summary-title,
.menu-confirm-sheet__item-name {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.menu-confirm-sheet__summary-text,
.menu-confirm-sheet__item-meta,
.menu-confirm-sheet__item-recipes,
.menu-confirm-sheet__tip,
.menu-confirm-sheet__state {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.menu-confirm-sheet__summary-text,
.menu-confirm-sheet__item-meta,
.menu-confirm-sheet__item-recipes {
  margin-top: 8rpx;
}

.menu-confirm-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.menu-confirm-sheet__item-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.menu-confirm-sheet__item-meta {
  margin-top: 0;
  white-space: nowrap;
}

.menu-confirm-sheet__state {
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.menu-confirm-sheet__state--empty {
  background: rgba(245, 247, 241, 0.96);
}

.menu-confirm-sheet__tip {
  color: var(--color-text-tertiary);
}

.menu-confirm-sheet__actions {
  display: flex;
  gap: 18rpx;
}

.menu-confirm-sheet__button {
  display: inline-flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 86rpx;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  text-align: center;
}

.menu-confirm-sheet__button::after {
  border: 0;
}

.menu-confirm-sheet__button--cancel {
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
}

.menu-confirm-sheet__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}
</style>
