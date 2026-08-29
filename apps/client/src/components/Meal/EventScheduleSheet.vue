<template>
  <SheetShell
    :visible="visible"
    :title="title"
    :subtitle="subtitle"
    @close="emit('close')"
    @after-close="emit('afterClose')"
  >
    <view class="event-schedule-sheet">
      <view class="event-schedule-sheet__field">
        <text class="event-schedule-sheet__label">{{ dateLabel }}</text>
        <MealMonthCalendar
          v-if="dateMode === 'calendar'"
          :selected-date="date"
          :month-date="monthDate"
          :min-date="minDate"
          @select="emit('selectDate', $event)"
          @month-change="emit('monthChange', $event)"
        />
        <picker v-else mode="date" :value="date" @change="handleDateChange">
          <view class="event-schedule-sheet__picker">{{ date }}</view>
        </picker>
      </view>

      <view v-if="mealSlots.length" class="event-schedule-sheet__field">
        <text class="event-schedule-sheet__label">{{ mealSlotLabel }}</text>
        <view class="event-schedule-sheet__chip-grid">
          <view
            v-for="item in mealSlots"
            :key="item.value"
            class="event-schedule-sheet__chip"
            :class="{
              'event-schedule-sheet__chip--active': mealSlot === item.value,
              'event-schedule-sheet__chip--disabled': item.disabled
            }"
            @click="handleMealSlotSelect(item)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>

      <view class="event-schedule-sheet__field">
        <text class="event-schedule-sheet__label">{{ timeLabel }}</text>
        <picker mode="time" :value="time" @change="handleTimeChange">
          <view class="event-schedule-sheet__time">
            <text class="cookfont icon-time event-schedule-sheet__time-icon" />
            <text class="event-schedule-sheet__time-text">{{ time }}</text>
          </view>
        </picker>
      </view>
    </view>

    <template #footer>
      <view class="event-schedule-sheet__actions">
        <button class="event-schedule-sheet__button event-schedule-sheet__button--cancel" :disabled="submitting" @click="emit('close')">
          {{ cancelText }}
        </button>
        <button class="event-schedule-sheet__button event-schedule-sheet__button--confirm" :disabled="submitting" @click="emit('confirm')">
          {{ submitting ? confirmLoadingText : confirmText }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import type { MealSlot } from "@/utils/meal-slot";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";

type EventScheduleMealSlot = {
  value: MealSlot;
  label: string;
  disabled?: boolean;
};

withDefaults(defineProps<{
  visible: boolean;
  title: string;
  subtitle?: string;
  date: string;
  dateMode?: "picker" | "calendar";
  monthDate?: string;
  minDate?: string | null;
  time: string;
  mealSlot: MealSlot;
  mealSlots?: EventScheduleMealSlot[];
  submitting?: boolean;
  cancelText?: string;
  confirmText: string;
  confirmLoadingText: string;
  dateLabel?: string;
  mealSlotLabel?: string;
  timeLabel?: string;
}>(), {
  subtitle: "",
  dateMode: "picker",
  monthDate: "",
  minDate: null,
  mealSlots: () => [],
  submitting: false,
  cancelText: "取消",
  dateLabel: "日期",
  mealSlotLabel: "餐次",
  timeLabel: "时间"
});

const emit = defineEmits<{
  close: [];
  afterClose: [];
  confirm: [];
  selectDate: [value: string];
  monthChange: [value: string];
  selectTime: [value: string];
  selectMealSlot: [value: MealSlot];
}>();

function handleDateChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  emit("selectDate", nextValue);
}

function handleTimeChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  emit("selectTime", nextValue);
}

function handleMealSlotSelect(item: EventScheduleMealSlot) {
  if (item.disabled) return;
  emit("selectMealSlot", item.value);
}
</script>

<style scoped lang="scss">
.event-schedule-sheet {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.event-schedule-sheet__field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.event-schedule-sheet__label {
  display: block;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.event-schedule-sheet__picker,
.event-schedule-sheet__time {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: 24rpx;
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  color: var(--color-text);
  font-size: 26rpx;
  box-sizing: border-box;
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.event-schedule-sheet__chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.event-schedule-sheet__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.event-schedule-sheet__chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.event-schedule-sheet__chip--disabled {
  border-color: var(--color-border-light);
  background: var(--color-surface-raised);
  color: var(--color-text-tertiary);
  opacity: 0.68;
}

.event-schedule-sheet__time {
  gap: 14rpx;
}

.event-schedule-sheet__time-icon,
.event-schedule-sheet__time-text {
  color: var(--color-support-action);
}

.event-schedule-sheet__time-icon {
  font-size: 28rpx;
}

.event-schedule-sheet__time-text {
  font-size: 30rpx;
  font-weight: 600;
}

.event-schedule-sheet__actions {
  display: flex;
  gap: 20rpx;
}

.event-schedule-sheet__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.event-schedule-sheet__button::after {
  border: 0;
}

.event-schedule-sheet__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.event-schedule-sheet__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}
</style>
