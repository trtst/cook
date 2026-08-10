<template>
  <SheetShell
    :visible="visible"
    title="标记完成并入库"
    subtitle="默认入库 7 天，可按项改数量和到期时间；不需要入库的食材可以直接关闭开关。"
    @close="$emit('close')"
    @after-close="$emit('after-close')"
  >
    <view v-if="!entries.length" class="sheet-note">当前没有需要入库的食材，确认后会直接完成这张清单。</view>
    <template v-else>
      <view class="quick-days">
        <text class="quick-days__label">批量到期</text>
        <view class="quick-days__chips">
          <text class="day-chip" @click="applyExpireDays(3)">3 天</text>
          <text class="day-chip" @click="applyExpireDays(7)">7 天</text>
          <text class="day-chip" @click="applyExpireDays(30)">30 天</text>
        </view>
      </view>

      <view class="complete-list">
        <view v-for="item in entries" :key="item.itemId" class="complete-card">
          <view class="complete-card__head">
            <view class="complete-card__main">
              <text class="complete-card__title">{{ item.name }}</text>
              <text class="complete-card__meta">{{ item.quantityText || "未填数量" }}</text>
            </view>
            <switch :checked="item.store" :color="switchColor" @change="toggleStore(item.itemId, $event)" />
          </view>

          <input
            :value="item.quantityText"
            class="sheet-input sheet-input--compact"
            maxlength="30"
            placeholder="入库数量"
            @input="setItemQuantity(item.itemId, $event)"
          />

          <view class="quick-days__chips">
            <text class="day-chip" :class="{ 'day-chip--active': item.expireDays === 3 }" @click="setItemExpireDays(item.itemId, 3)">3 天</text>
            <text class="day-chip" :class="{ 'day-chip--active': item.expireDays === 7 }" @click="setItemExpireDays(item.itemId, 7)">7 天</text>
            <text class="day-chip" :class="{ 'day-chip--active': item.expireDays === 30 }" @click="setItemExpireDays(item.itemId, 30)">30 天</text>
          </view>

          <picker mode="date" :value="item.expireAt || ''" @change="setItemExpireAt(item.itemId, $event)">
            <view class="picker-row">
              <text class="picker-row__label">到期时间</text>
              <text class="picker-row__value">{{ item.expireAt || expireText(item.expireDays) }}</text>
            </view>
          </picker>
        </view>
      </view>
    </template>

    <template #footer>
      <view class="sheet-actions">
        <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="$emit('close')">取消</button>
        <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? "提交中..." : "确认完成" }}
        </button>
      </view>
    </template>
  </SheetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UUID } from "@/apis/http";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useTheme } from "@/composables/useTheme";
import type { ShoppingCompleteEntry } from "./shopping-complete-sheet";

const props = withDefaults(defineProps<{
  visible: boolean;
  entries: ShoppingCompleteEntry[];
  submitting?: boolean;
}>(), {
  submitting: false
});

const emit = defineEmits<{
  (event: "close"): void;
  (event: "after-close"): void;
  (event: "submit"): void;
  (event: "update:entries", entries: ShoppingCompleteEntry[]): void;
}>();

const { themeVars } = useTheme();
const switchColor = computed(() => String(themeVars.value["--color-primary"] || themeVars.value["--button-primary-gradient-start"] || ""));

function updateEntries(mapper: (entries: ShoppingCompleteEntry[]) => ShoppingCompleteEntry[]) {
  emit("update:entries", mapper(props.entries));
}

function toggleStore(itemId: UUID, event: Event) {
  const nextValue = Boolean((event as Event & { detail?: { value?: boolean } }).detail?.value);
  updateEntries(entries => entries.map(item => (item.itemId === itemId ? { ...item, store: nextValue } : item)));
}

function applyExpireDays(days: number) {
  updateEntries(entries => entries.map(item => ({
    ...item,
    expireDays: days,
    expireAt: null
  })));
}

function setItemQuantity(itemId: UUID, event: Event) {
  const value = (event as Event & { detail?: { value?: string } }).detail?.value || "";
  updateEntries(entries => entries.map(item => (item.itemId === itemId ? { ...item, quantityText: value } : item)));
}

function setItemExpireDays(itemId: UUID, days: number) {
  updateEntries(entries => entries.map(item =>
    item.itemId === itemId
      ? {
          ...item,
          expireDays: days,
          expireAt: null
        }
      : item
  ));
}

function setItemExpireAt(itemId: UUID, event: Event) {
  const value = (event as Event & { detail?: { value?: string } }).detail?.value || "";
  updateEntries(entries => entries.map(item =>
    item.itemId === itemId
      ? {
          ...item,
          expireDays: null,
          expireAt: value || null
        }
      : item
  ));
}

function expireText(days: number | null) {
  if (!days) return "默认 7 天";
  return `${days} 天后到期`;
}
</script>

<style scoped lang="scss">
.sheet-note,
.quick-days__label,
.complete-card__meta,
.picker-row__label,
.picker-row__value {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.sheet-note,
.quick-days__label,
.complete-card__title,
.complete-card__meta,
.picker-row__label,
.picker-row__value {
  display: block;
}

.quick-days,
.complete-list {
  margin-top: 20rpx;
}

.quick-days__chips,
.complete-card__head,
.picker-row,
.sheet-actions {
  display: flex;
  gap: 16rpx;
}

.complete-card__head,
.picker-row {
  align-items: center;
  justify-content: space-between;
}

.complete-card {
  margin-top: 20rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.complete-card__main {
  flex: 1;
  min-width: 0;
}

.complete-card__title {
  color: var(--color-text);
  font-weight: var(--font-weight-heavy);
}

.complete-card__meta {
  margin-top: 8rpx;
}

.day-chip,
.sheet-actions__button {
  border-radius: var(--radius-pill);
}

.day-chip {
  padding: 12rpx 24rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  background: var(--color-surface-muted);
}

.day-chip--active {
  color: var(--color-primary);
  background: var(--color-primary-soft);
}

.picker-row {
  margin-top: 16rpx;
}

.sheet-actions__button {
  flex: 1;
  height: 88rpx;
  border: 0;
  font-size: 30rpx;
  line-height: 88rpx;
}

.sheet-actions__button::after {
  display: none;
}

.sheet-actions__button--cancel {
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
}

.sheet-actions__button--confirm {
  color: var(--color-on-primary);
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
}
</style>
