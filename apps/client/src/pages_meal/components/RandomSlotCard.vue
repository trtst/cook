<template>
  <view :class="['slot-card', `slot-card--${slot.status.toLowerCase()}`]">
    <view class="slot-card__head">
      <view class="slot-card__head-main">
        <text class="slot-card__slot">{{ slotTypeLabel }}</text>
        <text class="slot-card__title">{{ slot.title }}</text>
      </view>
      <text class="slot-card__badge">{{ fridgeFitLabel }}</text>
    </view>

    <view class="slot-card__meta">
      <text v-if="slot.durationText" class="slot-card__meta-item">{{ slot.durationText }}</text>
      <text v-if="slot.servings" class="slot-card__meta-item">{{ slot.servings }}人份</text>
      <text v-if="slot.mainProteinType" class="slot-card__meta-item">{{ proteinLabel }}</text>
    </view>

    <view v-if="slot.flavorTags.length" class="tag-row">
      <text v-for="item in slot.flavorTags" :key="item" class="tag-row__item">{{ item }}</text>
    </view>

    <view class="constraint-row">
      <view
        v-for="item in replaceChipOptions"
        :key="`${item.key}-${item.value}`"
        :class="[
          'constraint-chip',
          isConstraintActive(item.key, item.value) ? 'constraint-chip--active' : '',
          interactionDisabled ? 'constraint-chip--disabled' : ''
        ]"
        :hover-class="interactionDisabled ? '' : 'constraint-chip--hover'"
        hover-stay-time="100"
        @click="toggleConstraint(item.key, item.value)"
      >
        {{ item.label }}
      </view>
    </view>

    <view class="action-row">
      <view
        class="action-pill action-pill--muted action-pill--subtle"
        :class="{ 'action-pill--disabled': interactionDisabled }"
        :hover-class="interactionDisabled ? '' : 'action-pill--hover'"
        hover-stay-time="100"
        @click="toggleLock()"
      >
        {{ slot.status === "LOCKED" ? "取消保留" : "保留" }}
      </view>
      <view
        class="action-pill action-pill--muted action-pill--subtle"
        :class="{ 'action-pill--disabled': interactionDisabled }"
        :hover-class="interactionDisabled ? '' : 'action-pill--hover'"
        hover-stay-time="100"
        @click="removeSlot()"
      >
        划掉
      </view>
      <view
        class="action-pill action-pill--primary"
        :class="{ 'action-pill--disabled': interactionDisabled }"
        :hover-class="interactionDisabled ? '' : 'action-pill--hover'"
        hover-stay-time="100"
        @click="replaceSlot()"
      >
        {{ slot.status === "REPLACING" ? "替换中..." : "换一道" }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RandomReplaceConstraintKind } from "../apis/random";
import type { RandomSlotViewModel } from "../types/random";

const props = defineProps<{
  slot: RandomSlotViewModel;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  lock: [slotId: string];
  unlock: [slotId: string];
  remove: [slotId: string];
  replace: [slotId: string];
  toggleConstraint: [slotId: string, kind: RandomReplaceConstraintKind, value: string];
}>();

const slotTypeLabel = computed(() => {
  switch (props.slot.slotType) {
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
      return props.slot.slotType;
  }
});

const fridgeFitLabel = computed(() => {
  switch (props.slot.fridgeFit) {
    case "HIGH":
      return "冰箱匹配高";
    case "MEDIUM":
      return "冰箱匹配中";
    case "LOW":
      return "冰箱匹配低";
    default:
      return "库存未知";
  }
});

const proteinLabel = computed(() => {
  switch (props.slot.mainProteinType) {
    case "PORK":
      return "猪肉";
    case "CHICKEN":
      return "鸡肉";
    case "BEEF":
      return "牛肉";
    case "LAMB":
      return "羊肉";
    case "DUCK":
      return "鸭肉";
    case "FISH":
      return "鱼鲜";
    default:
      return "素菜";
  }
});

const interactionDisabled = computed(() => props.disabled || props.slot.status === "REPLACING");

const replaceChipOptions = [
  { key: "FLAVOR" as const, value: "NOT_SPICY", label: "不辣" },
  { key: "FLAVOR" as const, value: "LIGHT", label: "清淡" },
  { key: "DURATION" as const, value: "WITHIN_15", label: "15分钟" },
  { key: "DURATION" as const, value: "BETWEEN_30_60", label: "30-60分钟" },
  { key: "INGREDIENT" as const, value: "USE_FRIDGE_FIRST", label: "优先用冰箱" }
];

function isConstraintActive(kind: RandomReplaceConstraintKind, value: string) {
  return props.slot.replaceConstraints.some(item => item.kind === kind && item.value === value);
}

function toggleConstraint(kind: RandomReplaceConstraintKind, value: string) {
  if (interactionDisabled.value) return;
  emit("toggleConstraint", props.slot.slotId, kind, value);
}

function toggleLock() {
  if (interactionDisabled.value) return;
  if (props.slot.status === "LOCKED") {
    emit("unlock", props.slot.slotId);
    return;
  }
  emit("lock", props.slot.slotId);
}

function removeSlot() {
  if (interactionDisabled.value) return;
  emit("remove", props.slot.slotId);
}

function replaceSlot() {
  if (interactionDisabled.value) return;
  emit("replace", props.slot.slotId);
}
</script>

<style scoped lang="scss">
.slot-card {
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.slot-card--locked {
  box-shadow: 0 18rpx 36rpx var(--color-primary-soft);
}

.slot-card--removed {
  opacity: 0.72;
}

.slot-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.slot-card__head-main {
  min-width: 0;
  flex: 1;
}

.slot-card__slot {
  display: block;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.slot-card__title {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.slot-card__badge {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.slot-card__meta,
.tag-row,
.constraint-row,
.action-row {
  display: flex;
  flex-wrap: wrap;
}

.slot-card__meta {
  gap: 10rpx;
  margin-top: 16rpx;
}

.slot-card__meta-item,
.tag-row__item {
  padding: 8rpx 14rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.slot-card__meta-item {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.tag-row {
  gap: 10rpx;
  margin-top: 12rpx;
}

.tag-row__item {
  background: rgba(255, 220, 168, 0.24);
  color: #8b4d12;
}

.constraint-row {
  gap: 12rpx;
  margin-top: 18rpx;
}

.constraint-chip {
  padding: 10rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.constraint-chip--active {
  background: rgba(213, 236, 255, 0.9);
  color: var(--color-text);
}

.constraint-chip--disabled,
.constraint-chip--hover {
  opacity: 0.86;
}

.action-row {
  gap: 12rpx;
  margin-top: 22rpx;
}

.action-pill--disabled {
  opacity: 0.7;
}
</style>
