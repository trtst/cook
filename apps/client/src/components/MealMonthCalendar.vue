<template>
  <view class="month-calendar">
    <view class="month-calendar__bar">
      <text class="month-calendar__title">{{ monthTitle }}</text>
      <view class="month-calendar__actions">
        <view
          :class="['month-calendar__arrow', canGoPrevMonth ? '' : 'month-calendar__arrow--disabled']"
          :hover-class="canGoPrevMonth ? 'month-calendar__arrow--hover' : ''"
          hover-stay-time="100"
          @click="emitMonthChange(-1)"
        >
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
        v-for="cell in cells"
        :key="cell.key"
        :class="[
          'month-calendar__cell',
          cell.isPlaceholder ? 'month-calendar__cell--placeholder' : '',
          cell.isToday ? 'month-calendar__cell--today' : '',
          cell.isSelected ? 'month-calendar__cell--selected' : '',
          cell.isDisabled ? 'month-calendar__cell--disabled' : ''
        ]"
        :hover-class="cell.isPlaceholder || cell.isDisabled ? '' : 'month-calendar__cell--hover'"
        hover-stay-time="100"
        @click="handleSelect(cell)"
      >
        <template v-if="!cell.isPlaceholder">
          <text class="month-calendar__day">{{ cell.dayNumber }}</text>
          <view class="month-calendar__marks">
            <view v-if="cell.mark.breakfast" class="month-calendar__dot month-calendar__dot--breakfast" />
            <view v-if="cell.mark.lunch" class="month-calendar__dot month-calendar__dot--lunch" />
            <view v-if="cell.mark.afternoonTea" class="month-calendar__dot month-calendar__dot--afternoon-tea" />
            <view v-if="cell.mark.dinner" class="month-calendar__dot month-calendar__dot--dinner" />
            <view v-if="cell.mark.lateNight" class="month-calendar__dot month-calendar__dot--late-night" />
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { addMonths, formatDateOnly, parseDateOnly } from "@/utils/date";
import type { MealCalendarMark } from "@/utils/meal-slot";
import { createEmptyMealCalendarMark } from "@/utils/meal-slot";

interface CalendarCell {
  key: string;
  date: string | null;
  dayNumber: string;
  isPlaceholder: boolean;
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
const minDateValue = computed(() => (props.minDate ? parseDateOnly(props.minDate) : null));
const minMonthStart = computed(() => {
  if (!minDateValue.value) return null;
  return new Date(minDateValue.value.getFullYear(), minDateValue.value.getMonth(), 1, 12, 0, 0, 0);
});
const canGoPrevMonth = computed(() => {
  if (!minMonthStart.value) return true;
  const previousMonthStart = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() - 1, 1, 12, 0, 0, 0);
  return previousMonthStart.getTime() >= minMonthStart.value.getTime();
});

const cells = computed<CalendarCell[]>(() => {
  const firstWeekday = monthStart.value.getDay();
  const year = monthStart.value.getFullYear();
  const month = monthStart.value.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const result: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    result.push({
      key: `placeholder-start-${index}`,
      date: null,
      dayNumber: "",
      isPlaceholder: true,
      isToday: false,
      isSelected: false,
      isDisabled: true,
      mark: createEmptyMealCalendarMark()
    });
  }

  for (let day = 1; day <= dayCount; day += 1) {
    const date = new Date(year, month, day, 12, 0, 0, 0);
    const dateText = formatDateOnly(date);
    result.push({
      key: dateText,
      date: dateText,
      dayNumber: `${day}`,
      isPlaceholder: false,
      isToday: dateText === today,
      isSelected: dateText === props.selectedDate,
      isDisabled: Boolean(minDateValue.value && date.getTime() < minDateValue.value.getTime()),
      mark: props.marks[dateText] ?? createEmptyMealCalendarMark()
    });
  }

  const trailingCount = (7 - (result.length % 7 || 7)) % 7;
  for (let index = 0; index < trailingCount; index += 1) {
    result.push({
      key: `placeholder-end-${index}`,
      date: null,
      dayNumber: "",
      isPlaceholder: true,
      isToday: false,
      isSelected: false,
      isDisabled: true,
      mark: createEmptyMealCalendarMark()
    });
  }

  return result;
});

function emitMonthChange(offset: -1 | 1) {
  if (offset < 0 && !canGoPrevMonth.value) return;
  const nextMonth = addMonths(monthStart.value, offset);
  emit("monthChange", formatDateOnly(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 12, 0, 0, 0)));
}

function handleSelect(cell: CalendarCell) {
  if (cell.isPlaceholder || cell.isDisabled || !cell.date) return;
  emit("select", cell.date);
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

.month-calendar__arrow--disabled {
  opacity: 0.35;
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
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  padding: 10rpx;
  box-sizing: border-box;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--color-surface) 90%, var(--color-primary-soft) 10%);
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.month-calendar__cell--hover {
  transform: translateY(-2rpx);
}

.month-calendar__cell--placeholder {
  background: transparent;
}

.month-calendar__cell--today:not(.month-calendar__cell--selected):not(.month-calendar__cell--disabled) {
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
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  width: 42rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  transform: translateX(-50%);
}

.month-calendar__dot {
  width: 9rpx;
  height: 9rpx;
  border-radius: 999rpx;
}

.month-calendar__dot--breakfast {
  background: var(--meal-slot-breakfast);
}

.month-calendar__dot--lunch {
  background: var(--meal-slot-lunch);
}

.month-calendar__dot--afternoon-tea {
  background: var(--meal-slot-afternoon-tea);
}

.month-calendar__dot--dinner {
  background: var(--meal-slot-dinner);
}

.month-calendar__dot--late-night {
  background: var(--meal-slot-late-night);
}
</style>
