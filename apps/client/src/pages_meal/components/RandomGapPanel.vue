<template>
  <view class="gap-panel">
    <view class="gap-panel__head">
      <view>
        <text class="gap-panel__eyebrow">冰箱对比</text>
        <text class="gap-panel__title">{{ title }}</text>
      </view>
      <text v-if="summary" class="gap-panel__badge">{{ summaryText }}</text>
    </view>

    <view v-if="loading" class="gap-panel__loading">正在对比这桌和冰箱里的现有食材...</view>

    <view v-else-if="!items.length" class="gap-panel__empty">这桌和冰箱里的现有食材基本对得上，可以直接加入计划。</view>

    <view v-else class="gap-panel__list">
      <view v-for="item in items" :key="item.slotId" class="gap-card">
        <view class="gap-card__head">
          <view>
            <text class="gap-card__slot">{{ slotLabel(item.slotType) }}</text>
            <text class="gap-card__title">{{ item.recipeName }}</text>
          </view>
          <text :class="['gap-card__status', `gap-card__status--${item.status.toLowerCase()}`]">{{ statusLabel(item.status) }}</text>
        </view>

        <view v-if="item.missingIngredients.length" class="gap-card__ingredients">
          <view v-for="ingredient in item.missingIngredients" :key="ingredient.decisionKey" class="gap-row">
            <view class="gap-row__main">
              <text class="gap-row__name">{{ ingredient.ingredientName }}</text>
              <text class="gap-row__meta">{{ ingredient.quantityText || "数量未填写" }} · {{ inventoryLabel(ingredient.inventoryStatus) }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RandomGapInventoryStatus, RandomGapStatus, RandomGapSummary, RecipeSlotType } from "../apis/random";
import type { RandomGapItemViewModel } from "../types/random";

const props = defineProps<{
  items: RandomGapItemViewModel[];
  summary: RandomGapSummary | null;
  loading: boolean;
}>();

const title = computed(() => {
  if (props.loading) return "先看这一桌和冰箱里现有食材合不合";
  if (!props.items.length) return "这桌现有食材基本够用";
  return "这桌有几样食材还不够，先看一眼再决定下一步";
});

const summaryText = computed(() => {
  if (!props.summary) return "";
  const shortageCount = props.summary.partialCount + props.summary.missingCount + props.summary.unknownCount;
  return `${shortageCount} 道待补`;
});

function slotLabel(slotType: RecipeSlotType) {
  switch (slotType) {
    case "MEAT":
      return "荤菜";
    case "VEGETABLE":
      return "素菜";
    case "SOUP":
      return "汤";
    case "STAPLE":
      return "主食";
    case "BREAKFAST_STAPLE":
      return "早餐主食";
    case "BREAKFAST_PROTEIN":
      return "早餐蛋白";
    case "BREAKFAST_SIDE":
      return "水果/小食";
    default:
      return slotType;
  }
}

function statusLabel(status: RandomGapStatus) {
  switch (status) {
    case "OK":
      return "现有食材够用";
    case "PARTIAL":
      return "还缺一点";
    case "MISSING":
      return "缺得较多";
    case "UNKNOWN":
      return "记录不全";
    default:
      return status;
  }
}

function inventoryLabel(status: RandomGapInventoryStatus) {
  switch (status) {
    case "ENOUGH":
      return "库存足够";
    case "PARTIAL":
      return "库存不够";
    case "MISSING":
      return "冰箱里没有";
    case "UNKNOWN":
      return "暂未记录";
    default:
      return status;
  }
}
</script>

<style scoped lang="scss">
.gap-panel {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.gap-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.gap-panel__eyebrow,
.gap-card__slot {
  display: block;
  color: var(--color-support-action);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.gap-panel__title,
.gap-card__title {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.gap-panel__badge {
  flex: 0 0 auto;
  padding: 10rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.gap-panel__loading,
.gap-panel__empty {
  margin-top: 22rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.gap-panel__list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.gap-card {
  padding: 22rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.gap-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.gap-card__status {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.gap-card__status--ok {
  background: var(--color-state-success-soft);
  color: var(--color-state-success-text);
}

.gap-card__status--partial,
.gap-card__status--missing,
.gap-card__status--unknown {
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
}

.gap-card__ingredients {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.gap-row {
  display: flex;
  gap: 16rpx;
}

.gap-row__main {
  min-width: 0;
  flex: 1;
}

.gap-row__name {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.gap-row__meta {
  display: block;
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}
</style>
