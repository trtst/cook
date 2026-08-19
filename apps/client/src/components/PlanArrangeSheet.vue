<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <template v-if="titleExtra" #title-extra>
      <text class="plan-arrange-sheet__title-extra">{{ titleExtra }}</text>
    </template>

    <view class="plan-arrange-sheet">
      <view class="plan-arrange-sheet__section">
        <view class="plan-arrange-sheet__head">
          <text class="plan-arrange-sheet__label">{{ dateLabel }}</text>
          <text class="plan-arrange-sheet__date">{{ planDateText }}</text>
        </view>
        <MealMonthCalendar
          :selected-date="localDate"
          :month-date="localMonth"
          :marks="marks"
          :min-date="minDate"
          @select="handleDateSelect"
          @month-change="handleMonthChange"
        />
      </view>

      <view class="plan-arrange-sheet__section">
        <text class="plan-arrange-sheet__label">{{ mealSlotLabel }}</text>
        <view class="plan-arrange-sheet__slot-row">
          <view
            v-for="item in mealSlots"
            :key="item.value"
            :class="[
              'plan-arrange-sheet__slot',
              `plan-arrange-sheet__slot--${resolveMealSlotTone(item.value)}`,
              localMealSlot === item.value ? 'plan-arrange-sheet__slot--active' : ''
            ]"
            @click="localMealSlot = item.value"
          >
            {{ item.label }}
          </view>
        </view>
      </view>
    </view>

    <template #footer>
      <view v-if="showCancel" class="plan-arrange-sheet__actions">
        <button
          class="plan-arrange-sheet__button plan-arrange-sheet__button--cancel"
          :disabled="submitting"
          @click="emit('close')"
        >
          {{ cancelText }}
        </button>
        <button
          class="plan-arrange-sheet__button plan-arrange-sheet__button--confirm"
          :disabled="submitting"
          @click="submit"
        >
          {{ submitting ? confirmLoadingText : confirmText }}
        </button>
      </view>
      <view
        v-else
        :class="['plan-arrange-sheet__submit', submitting ? 'plan-arrange-sheet__submit--disabled' : '']"
        @click="submit"
      >
        {{ submitting ? confirmLoadingText : confirmText }}
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { MealCalendarMark, MealSlot, MealSlotOption } from "@/utils/meal-slot";
import { resolveMealSlotTone } from "@/utils/meal-slot";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { parseDateOnly } from "@/utils/date";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    title: string;
    subtitle?: string;
    titleExtra?: string;
    date: string;
    monthDate: string;
    mealSlot: MealSlot;
    mealSlots: MealSlotOption[];
    marks?: Record<string, MealCalendarMark>;
    minDate?: string | null;
    submitting?: boolean;
    showCancel?: boolean;
    cancelText?: string;
    confirmText: string;
    confirmLoadingText: string;
    dateLabel?: string;
    mealSlotLabel?: string;
  }>(),
  {
    subtitle: "",
    titleExtra: "",
    marks: () => ({}),
    minDate: null,
    submitting: false,
    showCancel: false,
    cancelText: "取消",
    dateLabel: "安排到哪天",
    mealSlotLabel: "安排到哪餐"
  }
);

const emit = defineEmits<{
  close: [];
  afterClose: [];
  monthChange: [monthDate: string];
  confirm: [payload: { planDate: string; mealSlot: MealSlot }];
}>();

const localDate = ref(props.date);
const localMonth = ref(props.monthDate);
const localMealSlot = ref<MealSlot>(props.mealSlot);

const planDateText = computed(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate.value)) return localDate.value;
  const [, month, day] = localDate.value.split("-");
  return `${Number(month)}月${Number(day)}日`;
});

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    localDate.value = props.date;
    localMonth.value = props.monthDate;
    localMealSlot.value = props.mealSlot;
  },
  { immediate: true }
);

function buildMonthAnchor(dateText: string) {
  const date = parseDateOnly(dateText);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01`;
}

function resolvePlanDateForMonth(monthDate: string) {
  if (props.minDate && buildMonthAnchor(props.minDate) === monthDate) {
    return props.minDate;
  }
  return monthDate;
}

function handleDateSelect(date: string) {
  localDate.value = date;
}

function handleMonthChange(nextMonthDate: string) {
  const nextMonth = buildMonthAnchor(nextMonthDate);
  if (nextMonth === localMonth.value) return;
  localMonth.value = nextMonth;
  if (buildMonthAnchor(localDate.value) !== nextMonth) {
    localDate.value = resolvePlanDateForMonth(nextMonth);
  }
  emit("monthChange", nextMonth);
}

function submit() {
  if (props.submitting) return;
  emit("confirm", { planDate: localDate.value, mealSlot: localMealSlot.value });
}
</script>

<style scoped lang="scss">
.plan-arrange-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.plan-arrange-sheet__title-extra {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: 500;
}

.plan-arrange-sheet__section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.plan-arrange-sheet__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24rpx;
}

.plan-arrange-sheet__label {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-arrange-sheet__date {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-arrange-sheet__slot-row {
  display: flex;
  gap: 16rpx;
}

.plan-arrange-sheet__slot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70rpx;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--color-surface-muted) 78%, var(--color-surface));
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-arrange-sheet__slot--active {
  font-weight: var(--font-weight-semibold);
}

.plan-arrange-sheet__slot--active.plan-arrange-sheet__slot--breakfast {
  background: var(--meal-slot-breakfast-soft);
  color: var(--meal-slot-breakfast);
}

.plan-arrange-sheet__slot--active.plan-arrange-sheet__slot--lunch {
  background: var(--meal-slot-lunch-soft);
  color: var(--meal-slot-lunch);
}

.plan-arrange-sheet__slot--active.plan-arrange-sheet__slot--afternoon-tea {
  background: var(--meal-slot-afternoon-tea-soft);
  color: var(--meal-slot-afternoon-tea);
}

.plan-arrange-sheet__slot--active.plan-arrange-sheet__slot--dinner {
  background: var(--meal-slot-dinner-soft);
  color: var(--meal-slot-dinner);
}

.plan-arrange-sheet__slot--active.plan-arrange-sheet__slot--late-night {
  background: var(--meal-slot-late-night-soft);
  color: var(--meal-slot-late-night);
}

.plan-arrange-sheet__actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
}

.plan-arrange-sheet__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88rpx;
  height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-arrange-sheet__button::after {
  border: 0;
}

.plan-arrange-sheet__button--confirm {
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.plan-arrange-sheet__button--cancel {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
}

.plan-arrange-sheet__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 92rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 28rpx;
  font-weight: 700;
}

.plan-arrange-sheet__submit--disabled {
  opacity: 0.68;
}
</style>
