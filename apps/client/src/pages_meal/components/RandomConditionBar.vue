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
        <view class="toggle-row__head">
          <text class="condition-group__title">优先消耗冰箱食材</text>
          <view class="toggle-row__check">
            <text class="toggle-row__state">{{ fridgePreferred ? "这轮优先" : "暂不优先" }}</text>
            <text
              class="cookfont toggle-row__icon"
              :class="fridgePreferred ? 'icon-select-on toggle-row__icon--checked' : 'icon-select-off'"
            />
          </view>
        </view>
        <text class="condition-group__description">只影响这一次随机和换菜，不会改动平时偏好。</text>
      </view>
    </view>

    <view v-if="slotPlan" class="condition-group">
      <text class="condition-group__title">这桌配置</text>
      <view class="slot-plan">
        <view v-for="item in planRows" :key="item.key" class="slot-plan__row">
          <text class="slot-plan__label">{{ item.label }}</text>
          <view class="slot-plan__stepper">
            <view
              class="cookfont slot-plan__button icon-stepper-minus"
              :class="{ 'slot-plan__button--disabled': loading }"
              :hover-class="loading ? '' : 'slot-plan__button--hover'"
              hover-stay-time="100"
              @click="adjustSlotPlan(item.key, -1)"
            />
            <text class="slot-plan__value">{{ item.value }}</text>
            <view
              class="cookfont slot-plan__button icon-stepper-add"
              :class="{ 'slot-plan__button--disabled': loading }"
              :hover-class="loading ? '' : 'slot-plan__button--hover'"
              hover-stay-time="100"
              @click="adjustSlotPlan(item.key, 1)"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CORE_MEAL_SLOTS, formatMealSlot } from "@/utils/meal-slot";
import type { MealSlot, RandomSlotPlan } from "../apis/random";

const props = defineProps<{
  mealSlot: MealSlot | null;
  peopleCount: number | null;
  fridgePreferred: boolean;
  slotPlan: RandomSlotPlan | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  selectMealSlot: [value: MealSlot];
  selectPeopleCount: [value: number];
  toggleFridgePreferred: [];
  adjustSlotPlan: [key: keyof RandomSlotPlan, delta: -1 | 1];
}>();

const mealSlotOptions = CORE_MEAL_SLOTS.map(value => ({
  value: value as MealSlot,
  label: formatMealSlot(value)
}));

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
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
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

.condition-group__description {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.chip-row {
  display: flex;
}

.chip-row {
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 16rpx;
}

.option-chip {
  font-size: 0;
  padding: 14rpx 22rpx;
  border: 1rpx solid transparent;
  border-radius: var(--radius-xs);
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
  border-color: var(--button-primary-border);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.option-chip__text {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.option-chip--active .option-chip__text {
  color: var(--button-primary-text);
}

.toggle-row {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
}

.toggle-row--disabled {
  opacity: 0.7;
}

.toggle-row__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.toggle-row__check {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  flex: 0 0 auto;
}

.toggle-row__state {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.toggle-row__icon {
  font-size: 34rpx;
  color: var(--color-outline);
}

.toggle-row__icon--checked {
  color: var(--color-support-action);
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
  border-radius: var(--radius-xs);
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
  color: var(--color-text);
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
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}
</style>
