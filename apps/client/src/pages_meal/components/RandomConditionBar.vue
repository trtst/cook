<template>
  <view class="condition-card">
    <view class="condition-group">
      <text class="condition-group__title">餐次</text>
      <view class="chip-row">
        <view
          v-for="item in mealSlotOptions"
          :key="item.value"
          :class="['option-chip', mealSlot === item.value ? 'option-chip--active' : '', loading ? 'option-chip--disabled' : '']"
          :hover-class="loading ? '' : 'option-chip--hover'"
          hover-stay-time="100"
          @click="selectMealSlot(item.value)"
        >
          <text class="option-chip__text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="condition-group">
      <text class="condition-group__title">人数</text>
      <view class="chip-row">
        <view
          v-for="item in peopleOptions"
          :key="item.value"
          :class="['option-chip', peopleCount === item.value ? 'option-chip--active' : '', loading ? 'option-chip--disabled' : '']"
          :hover-class="loading ? '' : 'option-chip--hover'"
          hover-stay-time="100"
          @click="selectPeopleCount(item.value)"
        >
          <text class="option-chip__text">{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="condition-group">
      <view class="toggle-row" :class="{ 'toggle-row--disabled': loading }" @click="toggleFridgePreferred">
        <view class="toggle-copy">
          <text class="condition-group__title">优先使用冰箱食材</text>
          <text class="toggle-row__hint">只影响当前这轮随机和替换，不修改全局偏好。</text>
        </view>
        <switch :checked="fridgePreferred" :disabled="loading" class="toggle-row__switch" @change.stop="toggleFridgePreferred" />
      </view>
    </view>

    <view v-if="slotPlan" class="condition-group">
      <text class="condition-group__title">这桌配置</text>
      <view class="slot-plan">
        <view v-for="item in planRows" :key="item.key" class="slot-plan__row">
          <text class="slot-plan__label">{{ item.label }}</text>
          <view class="slot-plan__stepper">
            <view
              class="slot-plan__button"
              :class="{ 'slot-plan__button--disabled': loading }"
              :hover-class="loading ? '' : 'slot-plan__button--hover'"
              hover-stay-time="100"
              @click="adjustSlotPlan(item.key, -1)"
            >
              -
            </view>
            <text class="slot-plan__value">{{ item.value }}</text>
            <view
              class="slot-plan__button"
              :class="{ 'slot-plan__button--disabled': loading }"
              :hover-class="loading ? '' : 'slot-plan__button--hover'"
              hover-stay-time="100"
              @click="adjustSlotPlan(item.key, 1)"
            >
              +
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="action-row">
      <button class="primary action-row__button" :disabled="generateDisabled || loading" @click="emit('generate')">
        {{ loading ? "生成中..." : hasMenu ? "再随机一桌" : "生成一桌" }}
      </button>
      <button class="secondary action-row__button" :disabled="!hasMenu || loading" @click="emit('reroll')">
        全部重摇
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MealSlot, RandomSlotPlan } from "../apis/random";

const props = defineProps<{
  mealSlot: MealSlot | null;
  peopleCount: number | null;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan | null;
  hasMenu: boolean;
  loading: boolean;
  generateDisabled: boolean;
}>();

const emit = defineEmits<{
  selectMealSlot: [value: MealSlot];
  selectPeopleCount: [value: number];
  toggleFridgePreferred: [];
  adjustSlotPlan: [key: keyof RandomSlotPlan, delta: -1 | 1];
  generate: [];
  reroll: [];
}>();

const mealSlotOptions = [
  { value: "BREAKFAST", label: "早餐" },
  { value: "LUNCH", label: "午餐" },
  { value: "DINNER", label: "晚餐" }
] as const;

const peopleOptions = [
  { value: 2, label: "1-2人" },
  { value: 4, label: "3-4人" },
  { value: 6, label: "5-6人" },
  { value: 8, label: "7人以上" }
] as const;

const planRows = computed(() => {
  if (!props.slotPlan) return [];
  if (props.mealSlot === "BREAKFAST") {
    return [
      { key: "breakfastStapleCount", label: "早餐主食", value: props.slotPlan.breakfastStapleCount },
      { key: "breakfastProteinCount", label: "早餐蛋白", value: props.slotPlan.breakfastProteinCount },
      { key: "breakfastSideCount", label: "水果/小食", value: props.slotPlan.breakfastSideCount }
    ] satisfies Array<{ key: keyof RandomSlotPlan; label: string; value: number }>;
  }
  return [
    { key: "meatCount", label: "荤菜", value: props.slotPlan.meatCount },
    { key: "vegetableCount", label: "素菜", value: props.slotPlan.vegetableCount },
    { key: "soupCount", label: "汤", value: props.slotPlan.soupCount },
    { key: "stapleCount", label: "主食", value: props.slotPlan.stapleCount }
  ] satisfies Array<{ key: keyof RandomSlotPlan; label: string; value: number }>;
});

function selectMealSlot(value: MealSlot) {
  if (props.loading) return;
  emit("selectMealSlot", value);
}

function selectPeopleCount(value: number) {
  if (props.loading) return;
  emit("selectPeopleCount", value);
}

function toggleFridgePreferred() {
  if (props.loading) return;
  emit("toggleFridgePreferred");
}

function adjustSlotPlan(key: keyof RandomSlotPlan, delta: -1 | 1) {
  if (props.loading) return;
  emit("adjustSlotPlan", key, delta);
}
</script>

<style scoped lang="scss">
.condition-card {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.condition-group + .condition-group {
  margin-top: 28rpx;
}

.condition-group__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.chip-row,
.action-row {
  display: flex;
}

.chip-row {
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.option-chip {
  padding: 14rpx 22rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  transition: transform 0.18s ease, background-color 0.18s ease;
}

.option-chip--hover {
  transform: translateY(-4rpx);
}

.option-chip--disabled {
  opacity: 0.68;
}

.option-chip--active {
  background: var(--color-primary-soft);
}

.option-chip__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.toggle-row--disabled {
  opacity: 0.7;
}

.toggle-copy {
  min-width: 0;
  flex: 1;
}

.toggle-row__hint {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.toggle-row__switch {
  flex: 0 0 auto;
  transform: scale(0.88);
  transform-origin: center right;
}

.slot-plan {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 16rpx;
}

.slot-plan__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.slot-plan__label {
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.slot-plan__stepper {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.slot-plan__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.88);
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.slot-plan__button--hover {
  opacity: 0.86;
}

.slot-plan__button--disabled {
  opacity: 0.6;
}

.slot-plan__value {
  min-width: 40rpx;
  text-align: center;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.action-row {
  gap: 16rpx;
  margin-top: 24rpx;
}

.action-row__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
