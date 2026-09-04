<template>
  <view :class="['month-calendar', props.enableViewSwitch ? 'month-calendar--switchable' : '']">
    <view class="month-calendar__bar">
      <view
        :class="[
          'month-calendar__arrow',
          'month-calendar__arrow--prev',
          canGoPrevMonth ? '' : 'month-calendar__arrow--disabled'
        ]"
        :hover-class="canGoPrevMonth ? 'month-calendar__arrow--hover' : ''"
        hover-stay-time="100"
        @click="moveCalendar(-1)"
      >
        <text class="cookfont icon-back month-calendar__arrow-icon" />
      </view>
      <view
        :class="['month-calendar__title-wrap', props.enableViewSwitch ? 'month-calendar__title-wrap--switchable' : '']"
        :hover-class="props.enableViewSwitch ? 'month-calendar__title-wrap--hover' : ''"
        hover-stay-time="100"
        @click="toggleViewMode"
      >
        <text class="month-calendar__title">{{ displayTitle }}</text>
        <text v-if="props.enableViewSwitch" class="cookfont icon-calendar-switch month-calendar__title-icon" />
      </view>
      <view
        :class="[
          'month-calendar__arrow',
          'month-calendar__arrow--next',
          canGoNextMonth ? '' : 'month-calendar__arrow--disabled'
        ]"
        :hover-class="canGoNextMonth ? 'month-calendar__arrow--hover' : ''"
        hover-stay-time="100"
        @click="moveCalendar(1)"
      >
        <text class="cookfont icon-back month-calendar__arrow-icon month-calendar__arrow-icon--right" />
      </view>
    </view>

    <view v-if="viewMode === 'day'" class="month-calendar__weekdays">
      <text v-for="item in WEEKDAY_LABELS" :key="item" class="month-calendar__weekday">{{ item }}</text>
    </view>

    <view v-if="viewMode === 'day'" class="month-calendar__grid month-calendar__view">
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

    <view
      v-else
      :class="[
        'month-calendar__picker',
        'month-calendar__view',
        viewMode === 'month' ? 'month-calendar__picker-grid--month' : 'month-calendar__picker-grid--year'
      ]"
    >
      <view
        v-for="item in pickerItems"
        :key="item.key"
        :class="[
          'month-calendar__picker-item',
          item.isSelected ? 'month-calendar__picker-item--selected' : '',
          item.isDisabled ? 'month-calendar__picker-item--disabled' : ''
        ]"
        :hover-class="item.isDisabled ? '' : 'month-calendar__picker-item--hover'"
        hover-stay-time="100"
        @click="selectPickerItem(item)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { formatDateOnly, parseDateOnly } from "@/utils/date";
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

interface PickerItem {
  key: string;
  value: number;
  label: string;
  isSelected: boolean;
  isDisabled: boolean;
}

type CalendarViewMode = "day" | "month" | "year";

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const props = withDefaults(
  defineProps<{
    selectedDate: string;
    monthDate: string;
    marks?: Record<string, MealCalendarMark>;
    minDate?: string | null;
    maxDate?: string | null;
    enableViewSwitch?: boolean;
  }>(),
  {
    marks: () => ({}),
    minDate: null,
    maxDate: null,
    enableViewSwitch: false
  }
);

const emit = defineEmits<{
  select: [date: string];
  monthChange: [monthDate: string];
}>();

const today = formatDateOnly(new Date());
const viewMode = ref<CalendarViewMode>("day");
const yearPageStart = ref(0);

const monthStart = computed(() => {
  const base = parseDateOnly(props.monthDate);
  return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
});

const monthTitle = computed(() => `${monthStart.value.getFullYear()}年${monthStart.value.getMonth() + 1}月`);
const yearTitle = computed(() => `${yearPageStart.value} - ${yearPageStart.value + 11}`);
const displayTitle = computed(() => {
  if (viewMode.value === "month") return `${monthStart.value.getFullYear()}年`;
  if (viewMode.value === "year") return yearTitle.value;
  return monthTitle.value;
});
const minDateValue = computed(() => (props.minDate ? parseDateOnly(props.minDate) : null));
const maxDateValue = computed(() => (props.maxDate ? parseDateOnly(props.maxDate) : null));
const minMonthStart = computed(() => {
  if (!minDateValue.value) return null;
  return new Date(minDateValue.value.getFullYear(), minDateValue.value.getMonth(), 1, 12, 0, 0, 0);
});
const canGoPrevMonth = computed(() => {
  if (viewMode.value === "year") return true;
  if (viewMode.value === "month") return !minDateValue.value || monthStart.value.getFullYear() > minDateValue.value.getFullYear();
  if (!minMonthStart.value) return true;
  const previousMonthStart = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() - 1, 1, 12, 0, 0, 0);
  return previousMonthStart.getTime() >= minMonthStart.value.getTime();
});
const maxMonthStart = computed(() => {
  if (!maxDateValue.value) return null;
  return new Date(maxDateValue.value.getFullYear(), maxDateValue.value.getMonth(), 1, 12, 0, 0, 0);
});
const canGoNextMonth = computed(() => {
  if (viewMode.value === "year") return true;
  if (viewMode.value === "month") return !maxDateValue.value || monthStart.value.getFullYear() < maxDateValue.value.getFullYear();
  if (!maxMonthStart.value) return true;
  const nextMonthStart = new Date(monthStart.value.getFullYear(), monthStart.value.getMonth() + 1, 1, 12, 0, 0, 0);
  return nextMonthStart.getTime() <= maxMonthStart.value.getTime();
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
      isDisabled: Boolean(
        (minDateValue.value && date.getTime() < minDateValue.value.getTime()) ||
        (maxDateValue.value && date.getTime() > maxDateValue.value.getTime())
      ),
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

const pickerItems = computed<PickerItem[]>(() => {
  if (viewMode.value === "year") {
    return Array.from({ length: 12 }, (_, index) => {
      const year = yearPageStart.value + index;
      return {
        key: `year-${year}`,
        value: year,
        label: `${year}年`,
        isSelected: year === monthStart.value.getFullYear(),
        isDisabled: isYearDisabled(year)
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return {
      key: `month-${month}`,
      value: index,
      label: `${month}月`,
      isSelected: index === monthStart.value.getMonth(),
      isDisabled: isMonthDisabled(monthStart.value.getFullYear(), index)
    };
  });
});

watch(
  () => props.enableViewSwitch,
  (enabled) => {
    if (!enabled) viewMode.value = "day";
  }
);

watch(
  () => monthStart.value.getFullYear(),
  (year) => {
    yearPageStart.value = year - (year % 12);
  },
  { immediate: true }
);

function moveCalendar(offset: -1 | 1) {
  if (offset < 0 && !canGoPrevMonth.value) return;
  if (offset > 0 && !canGoNextMonth.value) return;
  if (viewMode.value === "year") {
    yearPageStart.value += offset * 12;
    return;
  }
  if (viewMode.value === "month") {
    emitMonthFor(monthStart.value.getFullYear() + offset, monthStart.value.getMonth());
    return;
  }
  emitMonthFor(monthStart.value.getFullYear(), monthStart.value.getMonth() + offset);
}

function emitMonthFor(year: number, month: number) {
  const nextMonth = new Date(year, month, 1, 12, 0, 0, 0);
  emit("monthChange", formatDateOnly(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 12, 0, 0, 0)));
}

function handleSelect(cell: CalendarCell) {
  if (cell.isPlaceholder || cell.isDisabled || !cell.date) return;
  emit("select", cell.date);
}

function toggleViewMode() {
  if (!props.enableViewSwitch) return;
  if (viewMode.value === "day") {
    viewMode.value = "month";
    return;
  }
  viewMode.value = "year";
}

function selectPickerItem(item: PickerItem) {
  if (item.isDisabled) return;
  if (viewMode.value === "year") {
    emitMonthFor(item.value, monthStart.value.getMonth());
    viewMode.value = "month";
    return;
  }
  emitMonthFor(monthStart.value.getFullYear(), item.value);
  viewMode.value = "day";
}

function isMonthDisabled(year: number, month: number) {
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0, 0);
  return Boolean(
    (minDateValue.value && lastDay.getTime() < minDateValue.value.getTime()) ||
      (maxDateValue.value && firstDay.getTime() > maxDateValue.value.getTime())
  );
}

function isYearDisabled(year: number) {
  const firstDay = new Date(year, 0, 1, 12, 0, 0, 0);
  const lastDay = new Date(year, 11, 31, 12, 0, 0, 0);
  return Boolean(
    (minDateValue.value && lastDay.getTime() < minDateValue.value.getTime()) ||
      (maxDateValue.value && firstDay.getTime() > maxDateValue.value.getTime())
  );
}
</script>

<style scoped lang="scss">
.month-calendar {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.month-calendar__bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  min-height: 64rpx;
  transition: padding 0.2s ease;
}

.month-calendar--switchable .month-calendar__bar {
  justify-content: center;
  padding: 0 88rpx;
}

.month-calendar--switchable .month-calendar__arrow--prev {
  position: absolute;
  left: 0;
  top: 0;
}

.month-calendar--switchable .month-calendar__arrow--next {
  position: absolute;
  top: 0;
  right: 0;
}

.month-calendar__title-wrap {
  display: flex;
  align-items: center;
  gap: 8rpx;
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.month-calendar__title-wrap--switchable {
  justify-content: center;
}

.month-calendar__title-wrap--hover {
  opacity: 0.78;
  transform: translateY(-1rpx);
}

.month-calendar__title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--color-text);
}

.month-calendar__title-icon {
  color: var(--color-text-secondary);
  font-size: 34rpx;
  transition: transform 0.18s ease;
}

.month-calendar__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: var(--color-surface-primary-panel);
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

.month-calendar__view {
  animation: month-calendar-fade 0.18s ease both;
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
  background: var(--color-surface-soft-panel);
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.month-calendar__cell--hover {
  transform: translateY(-2rpx);
}

.month-calendar__cell--placeholder {
  background: transparent;
}

.month-calendar__cell--today:not(.month-calendar__cell--selected):not(.month-calendar__cell--disabled) {
  box-shadow: inset 0 0 0 2rpx var(--color-border-active);
}

.month-calendar__cell--selected {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 2rpx var(--color-border-active);
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

.month-calendar__picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.month-calendar__picker-grid--month {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.month-calendar__picker-grid--year {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.month-calendar__picker-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 84rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-soft-panel);
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
  transition: transform 0.16s ease, background-color 0.16s ease, opacity 0.16s ease;
}

.month-calendar__picker-item--hover {
  transform: translateY(-2rpx);
}

.month-calendar__picker-item--selected {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 2rpx var(--color-border-active);
}

.month-calendar__picker-item--disabled {
  opacity: 0.28;
}

@keyframes month-calendar-fade {
  from {
    opacity: 0;
    transform: translateY(8rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
