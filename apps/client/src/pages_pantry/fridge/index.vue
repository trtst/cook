<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="冰箱库存">
    <Login v-if="!sessionStore.isLoggedIn" title="登录后查看冰箱库存" description="冰箱库存只归你本人所有。" />

    <template v-else>
      <view class="summary-grid">
        <view class="summary-card">
          <text class="summary-card__label">食材总数</text>
          <text class="summary-card__value">{{ summary.total }}</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">临期数</text>
          <text class="summary-card__value">{{ summary.expiring }}</text>
          <text class="summary-card__hint">3 天内到期</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">已预占数</text>
          <text class="summary-card__value">{{ summary.reserved }}</text>
        </view>
        <view class="summary-card">
          <text class="summary-card__label">待补精确数量</text>
          <text class="summary-card__value">{{ summary.inexact }}</text>
        </view>
      </view>

      <input v-model="searchText" class="search-input" placeholder="搜索库存食材" />

      <view class="filter-row">
        <view
          v-for="item in filters"
          :key="item.value"
          class="filter-chip"
          :class="{ 'filter-chip--active': filterKey === item.value }"
          @click="filterKey = item.value"
        >
          {{ item.label }}
        </view>
      </view>

      <view v-if="errorText" class="notice" @click="loadItems">{{ errorText }}</view>
      <view v-else-if="loading" class="notice">加载中...</view>
      <Empty v-else-if="!visibleItems.length" title="当前没有可展示的库存" description="先新增食材，或切回其他状态筛选。" />

      <view v-else class="section-list">
        <view v-for="group in groups" :key="group.key" class="section-card">
          <view class="section-card__header">
            <text class="section-card__title">{{ group.title }}</text>
            <text class="section-card__count">{{ group.items.length }}</text>
          </view>

          <view v-for="item in group.items" :key="item.id" class="item-card">
            <view class="item-card__top">
              <view class="item-card__main">
                <text class="item-card__title">{{ item.name }}</text>
                <view class="badge-row">
                  <text v-if="isExpiring(item)" class="badge badge--warning">{{ expireLabel(item) }}</text>
                  <text v-if="hasReservations(item)" class="badge badge--info">预占中</text>
                  <text v-if="needsExact(item)" class="badge badge--muted">待补精确数量</text>
                </view>
              </view>
              <text class="item-card__date">{{ updatedLabel(item.updatedAt) }}</text>
            </view>

            <text v-if="item.note" class="item-card__note">{{ item.note }}</text>

            <view v-if="showExactMetrics(item)" class="metric-grid">
              <view class="metric-cell">
                <text class="metric-cell__label">实际库存</text>
                <text class="metric-cell__value">{{ item.stockText || "-" }}</text>
              </view>
              <view class="metric-cell">
                <text class="metric-cell__label">已预占</text>
                <text class="metric-cell__value">{{ item.reservedText || zeroReservedText(item) }}</text>
              </view>
              <view class="metric-cell">
                <text class="metric-cell__label">可用库存</text>
                <text class="metric-cell__value">{{ item.availableText || "-" }}</text>
              </view>
            </view>

            <view v-else class="stock-row">
              <text class="stock-row__label">当前库存</text>
              <text class="stock-row__value">{{ item.stockText || item.quantityText || "未填数量" }}</text>
            </view>

            <view v-if="hasReservations(item) && isExpanded(item.id)" class="reservation-list">
              <view v-for="reservation in item.reservations" :key="`${item.id}-${reservation.shoppingItemId}`" class="reservation-row">
                <text class="reservation-row__title">{{ reservation.shoppingListName }}</text>
                <text class="reservation-row__value">{{ reservation.reservedText }}</text>
              </view>
            </view>

            <view class="action-row">
              <button class="action-pill" @click="openEdit(item.id)">编辑</button>
              <button
                v-if="hasReservations(item)"
                class="action-pill action-pill--subtle"
                @click="toggleExpanded(item.id)"
              >
                {{ isExpanded(item.id) ? "收起预占" : "查看预占" }}
              </button>
              <button
                v-if="item.available"
                class="action-pill action-pill--primary"
                :disabled="isPending(item.id)"
                @click="consumeItem(item.id)"
              >
                {{ isPending(item.id) ? "处理中" : "扣减" }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view class="create-fab" hover-class="create-fab--hover" hover-stay-time="100" @click="openCreate">
        <text class="create-fab__icon">新增</text>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { fridgeApi, type FridgeItemSummary } from "../apis/fridge";
import { formatMonthDay } from "../utils/date";

const pageStyle = usePageScrollStyle();

const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const searchText = ref("");
const filterKey = ref<"ALL" | "EXPIRING" | "RESERVED" | "INEXACT">("ALL");
const items = ref<FridgeItemSummary[]>([]);
const pendingIds = ref<UUID[]>([]);
const expandedIds = ref<UUID[]>([]);

const filters = [
  { value: "ALL" as const, label: "全部" },
  { value: "EXPIRING" as const, label: "临期" },
  { value: "RESERVED" as const, label: "已预占" },
  { value: "INEXACT" as const, label: "待补精确数量" }
];

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadItems();
});

const activeItems = computed(() => items.value.filter(item => item.available || item.reservations.length > 0));

const summary = computed(() => ({
  total: activeItems.value.length,
  expiring: activeItems.value.filter(isExpiring).length,
  reserved: activeItems.value.filter(hasReservations).length,
  inexact: activeItems.value.filter(needsExact).length
}));

const visibleItems = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  return activeItems.value.filter(item => {
    if (keyword && !item.name.toLowerCase().includes(keyword)) {
      return false;
    }
    if (filterKey.value === "EXPIRING") return isExpiring(item);
    if (filterKey.value === "RESERVED") return hasReservations(item);
    if (filterKey.value === "INEXACT") return needsExact(item);
    return true;
  });
});

const groups = computed(() => {
  const expiring = visibleItems.value.filter(isExpiring);
  const reserved = visibleItems.value.filter(item => !isExpiring(item) && hasReservations(item));
  const normal = visibleItems.value.filter(item => !isExpiring(item) && !hasReservations(item));
  return [
    { key: "expiring", title: "即将到期", items: expiring },
    { key: "reserved", title: "有预占", items: reserved },
    { key: "normal", title: "普通库存", items: normal }
  ].filter(group => group.items.length > 0);
});

async function loadItems() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await fridgeApi.list(1, 100);
    items.value = result.items;
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "冰箱库存加载失败";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/item-edit/index");
}

function openEdit(itemId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_pantry/item-edit/index?itemId=${encodeURIComponent(String(itemId))}`);
}

async function consumeItem(itemId: UUID) {
  if (isPending(itemId)) return;
  pendingIds.value = [...pendingIds.value, itemId];
  try {
    await fridgeApi.consume([itemId], createOperationId());
    await uniPlatform.feedback.toast({ title: "已扣减", icon: "success" });
    await loadItems();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "扣减失败", icon: "none" });
  } finally {
    pendingIds.value = pendingIds.value.filter(id => id !== itemId);
  }
}

function hasReservations(item: FridgeItemSummary) {
  return item.reservations.length > 0;
}

function needsExact(item: FridgeItemSummary) {
  return !item.exactQuantity || !item.exactUnitId;
}

function showExactMetrics(item: FridgeItemSummary) {
  return Boolean(item.exactQuantity && item.exactUnitName);
}

function zeroReservedText(item: FridgeItemSummary) {
  return item.exactUnitName ? `0 ${item.exactUnitName}` : "0";
}

function isPending(itemId: UUID) {
  return pendingIds.value.includes(itemId);
}

function toggleExpanded(itemId: UUID) {
  expandedIds.value = isExpanded(itemId) ? expandedIds.value.filter(id => id !== itemId) : [...expandedIds.value, itemId];
}

function isExpanded(itemId: UUID) {
  return expandedIds.value.includes(itemId);
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function expireDiffDays(item: FridgeItemSummary) {
  const expireDate = parseDate(item.expireAt);
  if (!expireDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expireDate.getTime() - today.getTime()) / 86_400_000);
}

function isExpiring(item: FridgeItemSummary) {
  const diff = expireDiffDays(item);
  return diff !== null && diff <= 3;
}

function expireLabel(item: FridgeItemSummary) {
  const diff = expireDiffDays(item);
  if (diff === null) return "";
  if (diff < 0) return `已过期 ${Math.abs(diff)} 天`;
  if (diff === 0) return "今天到期";
  if (diff === 1) return "明天到期";
  return `${diff} 天后到期`;
}

function updatedLabel(value: string) {
  return `更新于 ${formatMonthDay(value)}`;
}
</script>

<style scoped lang="scss">
.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.summary-card,
.notice,
.section-card,
.search-input {
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.summary-card {
  padding: var(--space-md);
  border: 1rpx solid var(--color-border);
}

.summary-card__label,
.summary-card__value,
.summary-card__hint,
.section-card__title,
.section-card__count,
.item-card__title,
.item-card__date,
.item-card__note,
.metric-cell__label,
.metric-cell__value,
.stock-row__label,
.stock-row__value,
.reservation-row__title,
.reservation-row__value {
  display: block;
}

.summary-card__label,
.summary-card__hint,
.item-card__date,
.item-card__note,
.metric-cell__label,
.stock-row__label,
.reservation-row__title {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.summary-card__value,
.section-card__title,
.item-card__title,
.metric-cell__value,
.stock-row__value,
.reservation-row__value {
  color: var(--color-text);
}

.summary-card__value {
  margin-top: 10rpx;
  font-size: 42rpx;
  font-weight: var(--font-weight-bold);
}

.summary-card__hint {
  margin-top: 8rpx;
}

.search-input,
.notice,
.section-list {
  margin-top: var(--space-md);
}

.search-input {
  min-height: 88rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.filter-chip {
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.filter-chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.notice {
  padding: var(--space-md);
}

.section-card {
  padding: var(--space-md);
}

.section-card + .section-card {
  margin-top: var(--space-md);
}

.section-card__header,
.item-card__top,
.action-row,
.stock-row,
.reservation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-card__count {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.item-card {
  padding: var(--space-md) 0;
  border-top: 1rpx solid var(--color-border);
}

.item-card__top {
  align-items: flex-start;
  gap: var(--space-md);
}

.item-card__main {
  flex: 1;
  min-width: 0;
}

.item-card__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.item-card__date {
  white-space: nowrap;
}

.item-card__note {
  margin-top: 12rpx;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.badge {
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
}

.badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.badge--info {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge--muted {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 20rpx;
}

.metric-cell,
.stock-row,
.reservation-list {
  padding: 20rpx;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.metric-cell__value,
.stock-row__value {
  margin-top: 8rpx;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.stock-row,
.reservation-list,
.action-row {
  margin-top: 20rpx;
}

.stock-row {
  gap: var(--space-md);
}

.reservation-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.action-row {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 16rpx;
}

.action-pill {
  padding: 0 26rpx;
  line-height: 68rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.action-pill--subtle {
  color: var(--color-text-secondary);
}

.action-pill--primary {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
}

.create-fab {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 120rpx;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}

.create-fab--hover {
  opacity: 0.92;
}

.create-fab__icon {
  color: var(--button-primary-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}
</style>
