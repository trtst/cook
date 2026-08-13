<template>
  <view class="month-calendar">
    <view class="month-calendar__bar">
      <text class="month-calendar__title">{{ monthTitle }}</text>
      <view class="month-calendar__actions">
        <view class="month-calendar__arrow" hover-class="month-calendar__arrow--hover" hover-stay-time="100" @click="emitMonthChange(-1)">
          <text class="cookfont icon-back month-calendar__arrow-icon" />
        </view>
        <view class="month-calendar__arrow" hover-class="month-calendar__arrow--hover" hover-stay-time="100" @click="emitMonthChange(1)">
          <text class="cookfont icon-back month-calendar__arrow-icon month-calendar__arrow-icon--right" />
        </view>
      </view>
    </view>

    <view class="month-calendar__weekdays">
      <text v-for="item in WEEKDAY_LABELS" :key="item" class="month-calendar__weekday">{{ item }}</text>
    </view>

    <view class="month-calendar__grid">
      <view
        v-for="day in days"
        :key="day.date"
        :class="[
          'month-calendar__cell',
          day.isCurrentMonth ? '' : 'month-calendar__cell--muted',
          day.isToday ? 'month-calendar__cell--today' : '',
          day.isSelected ? 'month-calendar__cell--selected' : '',
          day.isDisabled ? 'month-calendar__cell--disabled' : ''
        ]"
        hover-class="month-calendar__cell--hover"
        hover-stay-time="100"
        @click="handleSelect(day)"
      >
        <text class="month-calendar__day">{{ day.dayNumber }}</text>
        <view class="month-calendar__marks">
          <view v-if="day.mark.breakfast" class="month-calendar__dot month-calendar__dot--breakfast" />
          <view v-if="day.mark.lunch" class="month-calendar__dot month-calendar__dot--lunch" />
          <view v-if="day.mark.dinner" class="month-calendar__dot month-calendar__dot--dinner" />
          <text v-if="day.mark.hasExtra" class="month-calendar__extra">+</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { addDays, addMonths, formatDateOnly, parseDateOnly, startOfWeek } from "@/pages_meal/utils/date";
import type { MealCalendarMark } from "@/utils/meal-slot";
import { createEmptyMealCalendarMark } from "@/utils/meal-slot";

interface CalendarDay {
  date: string;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  mark: MealCalendarMark;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const props = withDefaults(
  defineProps<{
    selectedDate: string;
    monthDate: string;
    marks?: Record<string, MealCalendarMark>;
    minDate?: string | null;
  }>(),
  {
    marks: () => ({}),
    minDate: null
  }
);

const emit = defineEmits<{
  select: [date: string];
  monthChange: [monthDate: string];
}>();

const today = formatDateOnly(new Date());

const monthStart = computed(() => {
  const base = parseDateOnly(props.monthDate);
  return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
});

const monthTitle = computed(() => `${monthStart.value.getFullYear()}年${monthStart.value.getMonth() + 1}月`);

const days = computed<CalendarDay[]>(() => {
  const gridStart = startOfWeek(monthStart.value);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const dateText = formatDateOnly(date);
    return {
      date: dateText,
      dayNumber: `${date.getDate()}`,
      isCurrentMonth: date.getMonth() === monthStart.value.getMonth(),
      isToday: dateText === today,
      isSelected: dateText === props.selectedDate,
      isDisabled: Boolean(props.minDate && dateText < props.minDate),
      mark: props.marks[dateText] ?? createEmptyMealCalendarMark()
    };
  });
});

function emitMonthChange(offset: -1 | 1) {
  const nextMonth = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() + offset, 1, 12, 0, 0, 0);
  emit("monthChange", formatDateOnly(nextMonth));
}

function handleSelect(day: CalendarDay) {
  if (day.isDisabled) return;
  if (!day.isCurrentMonth) {
    emit("monthChange", `${day.date.slice(0, 8)}01`);
  }
  emit("select", day.date);
}
</script>

<style scoped lang="scss">
.month-calendar {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.month-calendar__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.month-calendar__title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-text);
}

.month-calendar__actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.month-calendar__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-surface) 84%, var(--color-primary-soft) 16%);
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.month-calendar__arrow--hover {
  transform: scale(0.96);
}

.month-calendar__arrow-icon {
  font-size: 28rpx;
  color: var(--color-text);
}

.month-calendar__arrow-icon--right {
  transform: rotate(180deg);
}

.month-calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12rpx;
}

.month-calendar__weekday {
  text-align: center;
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.month-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12rpx;
}

.month-calendar__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 108rpx;
  padding: 16rpx 8rpx 12rpx;
  box-sizing: border-box;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 90%, var(--color-primary-soft) 10%);
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.month-calendar__cell--hover {
  transform: translateY(-2rpx);
}

.month-calendar__cell--muted {
  opacity: 0.45;
}

.month-calendar__cell--today:not(.month-calendar__cell--selected) {
  box-shadow: inset 0 0 0 2rpx color-mix(in srgb, var(--color-primary) 28%, transparent);
}

.month-calendar__cell--selected {
  background: color-mix(in srgb, var(--color-primary-soft) 72%, white 28%);
  box-shadow: inset 0 0 0 2rpx color-mix(in srgb, var(--color-primary) 42%, transparent);
}

.month-calendar__cell--disabled {
  opacity: 0.28;
}

.month-calendar__day {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--color-text);
}

.month-calendar__marks {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  min-height: 20rpx;
}

.month-calendar__dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 999rpx;
}

.month-calendar__dot--breakfast {
  background: #f4a261;
}

.month-calendar__dot--lunch {
  background: #2a9d8f;
}

.month-calendar__dot--dinner {
  background: #e76f51;
}

.month-calendar__extra {
  font-size: 18rpx;
  line-height: 1;
  color: var(--color-text-secondary);
}
</style>
