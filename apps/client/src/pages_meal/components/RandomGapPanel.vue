<template>
  <view class="gap-panel">
    <view class="gap-panel__head">
      <view>
        <text class="gap-panel__eyebrow">本桌缺口预检</text>
        <text class="gap-panel__title">{{ title }}</text>
      </view>
      <text v-if="summary" class="gap-panel__badge">{{ summaryText }}</text>
    </view>

    <view v-if="loading" class="gap-panel__loading">正在检查这桌现在还差什么...</view>

    <view v-else-if="!items.length" class="gap-panel__empty">当前没有需要处理的菜位。</view>

    <view v-else class="gap-panel__list">
      <view v-for="item in items" :key="item.slotId" class="gap-card">
        <view class="gap-card__head">
          <view>
            <text class="gap-card__slot">{{ slotLabel(item.slotType) }}</text>
            <text class="gap-card__title">{{ item.recipeName }}</text>
          </view>
          <text :class="['gap-card__status', `gap-card__status--${item.status.toLowerCase()}`]">{{ statusLabel(item.status) }}</text>
        </view>

        <view v-if="item.decisions.length" class="gap-card__ingredients">
          <view v-for="decision in item.decisions" :key="decision.decisionKey" class="gap-row">
            <view class="gap-row__main">
              <text class="gap-row__name">{{ decision.ingredientName }}</text>
              <text class="gap-row__meta">{{ decision.quantityText || "数量未填写" }} · {{ inventoryLabel(decision.inventoryStatus) }}</text>
            </view>
            <view class="gap-row__actions">
              <view
                :class="['gap-row__decision', decision.decision === 'HAS' ? 'gap-row__decision--active' : '', loading ? 'gap-row__decision--disabled' : '']"
                :hover-class="loading ? '' : 'gap-row__decision--hover'"
                hover-stay-time="100"
                @click="updateDecision(item.slotId, decision.decisionKey, 'HAS')"
              >
                确认有
              </view>
              <view
                :class="['gap-row__decision', decision.decision === 'MISSING' ? 'gap-row__decision--active' : '', loading ? 'gap-row__decision--disabled' : '']"
                :hover-class="loading ? '' : 'gap-row__decision--hover'"
                hover-stay-time="100"
                @click="updateDecision(item.slotId, decision.decisionKey, 'MISSING')"
              >
                确认无
              </view>
            </view>
          </view>
        </view>

        <view class="gap-card__footer">
          <view
            class="action-pill action-pill--muted action-pill--subtle"
            :class="{ 'action-pill--disabled': loading }"
            :hover-class="loading ? '' : 'action-pill--hover'"
            hover-stay-time="100"
            @click="removeSlot(item.slotId)"
          >
            划掉这道
          </view>
          <view
            class="action-pill action-pill--muted action-pill--subtle"
            :class="{ 'action-pill--disabled': loading }"
            :hover-class="loading ? '' : 'action-pill--hover'"
            hover-stay-time="100"
            @click="replaceSlot(item.slotId)"
          >
            换一道
          </view>
          <view
            class="action-pill action-pill--muted"
            :class="{ 'action-pill--disabled': loading }"
            :hover-class="loading ? '' : 'action-pill--hover'"
            hover-stay-time="100"
            @click="keepPending(item.slotId)"
          >
            保留待采购
          </view>
          <view
            v-if="item.actions.canAddToShopping"
            class="action-pill action-pill--primary"
            :class="{ 'action-pill--disabled': loading }"
            :hover-class="loading ? '' : 'action-pill--hover'"
            hover-stay-time="100"
            @click="buySlot(item.slotId)"
          >
            采购这道缺口
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RandomGapDecision, RandomGapStatus, RandomGapSummary, RecipeSlotType } from "../apis/random";
import type { RandomGapItemViewModel } from "../types/random";

const props = defineProps<{
  items: RandomGapItemViewModel[];
  summary: RandomGapSummary | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  updateDecision: [slotId: string, decisionKey: string, decision: RandomGapDecision];
  removeSlot: [slotId: string];
  replaceSlot: [slotId: string];
  keepPending: [slotId: string];
  buySlot: [slotId: string];
}>();

const title = computed(() => {
  if (props.loading) return "先把能做、缺料和库存不确定的地方收清楚";
  if (!props.items.length) return "这桌当前没有需要处理的缺口";
  return "加入计划前，先确认这桌现在能不能做";
});

const summaryText = computed(() => {
  if (!props.summary) return "";
  return `缺料 ${props.summary.missingCount} · 待确认 ${props.summary.unknownCount}`;
});

function updateDecision(slotId: string, decisionKey: string, decision: RandomGapDecision) {
  if (props.loading) return;
  emit("updateDecision", slotId, decisionKey, decision);
}

function removeSlot(slotId: string) {
  if (props.loading) return;
  emit("removeSlot", slotId);
}

function replaceSlot(slotId: string) {
  if (props.loading) return;
  emit("replaceSlot", slotId);
}

function keepPending(slotId: string) {
  if (props.loading) return;
  emit("keepPending", slotId);
}

function buySlot(slotId: string) {
  if (props.loading) return;
  emit("buySlot", slotId);
}

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
      return "可直接做";
    case "PARTIAL":
      return "部分缺料";
    case "MISSING":
      return "缺料较多";
    case "UNKNOWN":
      return "库存未确认";
    default:
      return status;
  }
}

function inventoryLabel(status: "ENOUGH" | "PARTIAL" | "MISSING" | "UNKNOWN") {
  switch (status) {
    case "ENOUGH":
      return "库存足够";
    case "PARTIAL":
      return "库存部分可用";
    case "MISSING":
      return "库存不足";
    case "UNKNOWN":
      return "库存未确认";
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
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
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
  color: var(--color-primary);
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
  background: rgba(107, 196, 92, 0.18);
  color: #2e7d32;
}

.gap-card__status--partial,
.gap-card__status--missing,
.gap-card__status--unknown {
  background: rgba(255, 220, 168, 0.28);
  color: #8b4d12;
}

.gap-card__ingredients {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.gap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
}

.gap-row__actions,
.gap-card__footer {
  display: flex;
  flex-wrap: wrap;
}

.gap-row__actions {
  gap: 10rpx;
}

.gap-row__decision {
  padding: 10rpx 16rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.gap-row__decision--active {
  background: var(--color-primary-soft);
  color: var(--color-text);
}

.gap-row__decision--disabled {
  opacity: 0.6;
}

.gap-row__decision--hover {
  opacity: 0.88;
}

.gap-card__footer {
  gap: 12rpx;
  margin-top: 20rpx;
}
</style>
