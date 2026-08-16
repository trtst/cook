<template>
  <page-meta :page-style="pageStyle" />
  <Layout
    title=""
    full-screen
    navbar-layout="custom-left"
    :show-left="false"
    :navbar-transparent="sessionStore.isLoggedIn"
    :navbar-placeholder="!sessionStore.isLoggedIn"
  >
    <template #navbar-left>
      <view class="complete-nav">
        <view class="cookfont icon-back complete-nav__back" hover-class="complete-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="complete-nav__title" :style="navTitleStyle">标记完成并入库</text>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后继续入库"
      description="入库确认需要登录后处理。"
      @success="handleLoginSuccess"
    />

    <view v-else class="complete-page">
      <view class="complete-nav-backdrop" :style="navBackdropStyle" />
      <view v-if="loading" class="notice">加载中...</view>
      <view v-else-if="errorText" class="notice" @click="loadDetail">{{ errorText }}</view>
      <template v-else-if="detail">
        <scroll-view scroll-y class="complete-scroll" :show-scrollbar="false" @scroll="handleScroll">
          <view class="complete-body">
            <view class="complete-hero" :style="heroStyle">
              <text class="complete-hero__title" :style="heroTitleStyle">{{ heroTitle }}</text>
              <text class="complete-hero__desc">把数量和到期时间再看一眼，确认好就收进库存。</text>
            </view>

            <view class="complete-content">
              <view v-if="entries.length" class="complete-panel">
                <view class="complete-filter">
                  <view
                    v-for="item in filterOptions"
                    :key="item.key"
                    class="complete-filter__item"
                    :class="{ 'complete-filter__item--active': activeFilter === item.key }"
                    @click="activeFilter = item.key"
                  >
                    <text class="complete-filter__count" :class="{ 'complete-filter__count--accent': activeFilter === item.key }">{{ item.count }}</text>
                    <text class="complete-filter__label">{{ item.label }}</text>
                  </view>
                </view>
              </view>

              <Empty
                v-if="!entries.length"
                class="complete-empty"
                title="当前没有待入库食材"
                description="这张清单会直接按完成处理。"
              />

              <Empty
                v-else-if="!visibleEntries.length"
                class="complete-empty"
                :title="activeFilter === 'CONFIRMED' ? '当前没有已确认食材' : '当前没有未确认食材'"
                :description="activeFilter === 'CONFIRMED' ? '等你确认过的食材会出现在这里。' : '这批食材都已经确认好了，可以直接提交。'"
              />

              <view v-else class="complete-list">
                <view
                  v-for="item in visibleEntries"
                  :key="item.itemId"
                  class="complete-card"
                  :class="{ 'complete-card--pending': !item.confirmed }"
                >
                  <view class="complete-card__head">
                    <view class="complete-card__summary">
                      <view class="complete-card__cover">
                        <image v-if="item.imageUrl" class="complete-card__image" :src="item.imageUrl" mode="aspectFill" />
                        <view v-else class="complete-card__placeholder">食材</view>
                      </view>
                      <view class="complete-card__info">
                        <text class="complete-card__title">{{ item.name }}</text>
                        <view class="complete-card__meta">
                          <text class="complete-card__category">{{ item.categoryName || "未分类" }}</text>
                        </view>
                      </view>
                    </view>
                    <view class="complete-card__toggle" @click="toggleStore(item.itemId)">
                      <text class="complete-card__state">{{ item.confirmed ? "已确认" : "待确认" }}</text>
                      <text
                        class="cookfont complete-card__toggle-icon"
                        :class="item.confirmed ? 'icon-select-on' : 'icon-select-off'"
                      />
                    </view>
                  </view>

                  <view class="complete-card__fields">
                    <view class="field-block field-block--action" @click="openQuantitySheet(item.itemId)">
                      <view class="field-block__row">
                        <view class="field-block__main">
                          <text class="field-block__label">入库数量</text>
                          <text class="field-block__hint">点一下改数字，单位会保持不变。</text>
                        </view>
                        <text class="field-block__value">{{ quantityDisplay(item) }}</text>
                      </view>
                      <scroll-view scroll-x class="field-block__scroll" :show-scrollbar="false">
                        <view class="field-block__chips field-block__chips--row">
                          <view
                            v-for="option in quantityShortcutOptions(item)"
                            :key="option.label"
                            class="quick-chip"
                            :class="{ 'quick-chip--active': quantityDisplay(item) === option.label }"
                            @click.stop="applyQuantityShortcut(item.itemId, option.value)"
                          >
                            {{ option.label }}
                          </view>
                        </view>
                      </scroll-view>
                    </view>

                    <view class="field-block field-block--action" @click="openExpireSheet(item.itemId)">
                      <view class="field-block__row field-block__row--picker">
                        <view class="field-block__main">
                          <text class="field-block__label">到期时间</text>
                          <text class="field-block__hint">点一下打开日历，选一个到期日期。</text>
                        </view>
                        <text class="field-block__value">{{ resolveExpireDate(item) }}</text>
                      </view>

                      <scroll-view scroll-x class="field-block__scroll" :show-scrollbar="false">
                        <view class="field-block__chips field-block__chips--row">
                          <view
                            v-for="shortcut in expireShortcuts"
                            :key="shortcut.key"
                            class="quick-chip"
                            :class="{ 'quick-chip--active': isExpireShortcutActive(item, shortcut) }"
                            @click.stop="applyExpireShortcut(item.itemId, shortcut)"
                          >
                            {{ shortcut.label }}
                          </view>
                        </view>
                      </scroll-view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="complete-footer">
          <view class="complete-footer__main">
            <button class="complete-footer__button" :disabled="submitting" @click="submitComplete">
              {{ submitting ? "提交中..." : submitText }}
            </button>
          </view>
        </view>
      </template>
    </view>

    <SheetShell
      :visible="quantitySheetVisible"
      title="确认入库数量"
      :subtitle="quantitySheetSubtitle"
      @close="closeQuantitySheet"
      @after-close="handleQuantitySheetAfterClose"
    >
      <view v-if="quantitySheetEntry" class="quantity-sheet">
        <view class="quantity-sheet__hero">
          <text class="quantity-sheet__name">{{ quantitySheetEntry.name }}</text>
          <text class="quantity-sheet__meta">{{ quantitySheetEntry.categoryName || "未分类" }}</text>
        </view>

        <view class="quantity-sheet__editor">
          <text class="quantity-sheet__label">当前入库数量</text>
          <view class="quantity-sheet__input-wrap">
            <input
              v-model="quantityDraft"
              class="quantity-sheet__input"
              type="digit"
              maxlength="12"
              placeholder="请输入数量"
            />
            <text v-if="quantitySheetEntry.quantityUnit" class="quantity-sheet__unit">{{ quantitySheetEntry.quantityUnit }}</text>
          </view>
        </view>

        <view v-if="quantityQuickOptions.length" class="quantity-sheet__shortcuts">
          <text class="quantity-sheet__label">快捷填写</text>
          <view class="quantity-sheet__chips">
            <view
              v-for="option in quantityQuickOptions"
              :key="option.label"
              class="quick-chip"
              :class="{ 'quick-chip--active': quantityDraft === option.valueText }"
              @click="quantityDraft = option.valueText"
            >
              {{ option.label }}
            </view>
          </view>
        </view>
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeQuantitySheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting || quantityConfirmDisabled" @click="applyQuantitySheet">
            确认
          </button>
        </view>
      </template>
    </SheetShell>

    <SheetShell
      :visible="expireSheetVisible"
      title="选择到期时间"
      subtitle="选好日期后，这条食材会按这一天记录到期时间。"
      @close="closeExpireSheet"
      @after-close="handleExpireSheetAfterClose"
    >
      <view v-if="expireSheetEntry" class="expire-sheet">
        <view class="expire-sheet__hero">
          <text class="expire-sheet__label">到期时间</text>
          <text class="expire-sheet__value">{{ expireDraftDate }}</text>
        </view>

        <MealMonthCalendar
          :selected-date="expireDraftDate"
          :month-date="expireSheetMonth"
          :min-date="todayDate"
          @select="handleExpireDateSelect"
          @month-change="handleExpireMonthChange"
        />
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="submitting" @click="closeExpireSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="submitting || !expireDraftDate" @click="applyExpireSheet">
            确认
          </button>
        </view>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import type { UUID } from "@/apis/http";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { shoppingApi, type ShoppingListDetail, type ShoppingListDetailItem } from "../apis/shopping";
import { type ShoppingCompleteSource, stashShoppingCompleteResult } from "./bridge";

interface CompleteEntry {
  itemId: UUID;
  name: string;
  categoryName: string | null;
  imageUrl: string | null;
  quantityText: string;
  quantityValue: number | null;
  quantityUnit: string;
  store: boolean;
  confirmed: boolean;
  expireDays: number | null;
  expireAt: string | null;
}

interface ExpireShortcut {
  key: string;
  label: string;
  unit: "day" | "month" | "year";
  value: number;
}

const NAV_FADE_DISTANCE = 132;
const QUANTITY_MULTIPLIERS = [1, 1.5, 2, 3, 5, 10, 20] as const;
const expireShortcuts: ExpireShortcut[] = [
  { key: "3d", label: "3天", unit: "day", value: 3 },
  { key: "5d", label: "5天", unit: "day", value: 5 },
  { key: "7d", label: "7天", unit: "day", value: 7 },
  { key: "15d", label: "15天", unit: "day", value: 15 },
  { key: "1m", label: "1个月", unit: "month", value: 1 },
  { key: "2m", label: "2月", unit: "month", value: 2 },
  { key: "3m", label: "3月", unit: "month", value: 3 },
  { key: "6m", label: "6月", unit: "month", value: 6 },
  { key: "9m", label: "9月", unit: "month", value: 9 },
  { key: "1y", label: "1年", unit: "year", value: 1 },
  { key: "2y", label: "2年", unit: "year", value: 2 }
];

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();

const listId = ref<UUID | "">("");
const source = ref<ShoppingCompleteSource>("detail");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const detail = ref<ShoppingListDetail | null>(null);
const entries = ref<CompleteEntry[]>([]);
const activeFilter = ref<"ALL" | "CONFIRMED" | "PENDING">("ALL");
const scrollTop = ref(0);

const quantitySheetVisible = ref(false);
const quantitySheetItemId = ref<UUID | "">("");
const quantityDraft = ref("");
const expireSheetVisible = ref(false);
const expireSheetItemId = ref<UUID | "">("");
const expireSheetMonth = ref("");
const expireDraftDate = ref("");

const confirmedCount = computed(() => entries.value.filter(item => item.confirmed).length);
const pendingCount = computed(() => Math.max(entries.value.length - confirmedCount.value, 0));
const storeCount = computed(() => entries.value.filter(item => item.store).length);
const filterOptions = computed(() => [
  { key: "ALL" as const, label: "全部", count: entries.value.length },
  { key: "PENDING" as const, label: "未确认", count: pendingCount.value },
  { key: "CONFIRMED" as const, label: "已确认", count: confirmedCount.value }
]);
const visibleEntries = computed(() => {
  if (activeFilter.value === "CONFIRMED") {
    return entries.value.filter(item => item.confirmed);
  }
  if (activeFilter.value === "PENDING") {
    return entries.value.filter(item => !item.confirmed);
  }
  return entries.value;
});
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navTitleStyle = computed(() => ({
  opacity: sessionStore.isLoggedIn ? `${navProgress.value}` : "1"
}));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 12}px`
}));
const heroTitleStyle = computed(() => ({
  opacity: `${1 - navProgress.value * 0.56}`
}));
const heroTitle = computed(() => detail.value?.name ? `${detail.value.name} · 确认入库` : "确认入库");
const todayDate = formatDate(new Date());
const submitText = computed(() => {
  if (!entries.value.length || !storeCount.value) return "确认完成清单";
  return `确认完成并入库 ${storeCount.value} 项`;
});
const quantitySheetEntry = computed(() => entries.value.find(item => item.itemId === quantitySheetItemId.value) ?? null);
const expireSheetEntry = computed(() => entries.value.find(item => item.itemId === expireSheetItemId.value) ?? null);
const quantitySheetSubtitle = computed(() => {
  if (!quantitySheetEntry.value) return "把这条食材的入库数量再确认一下。";
  if (!quantitySheetEntry.value.quantityUnit) return "直接改数量，确认后会同步回填。";
  return `改一下数字就行，单位还是 ${quantitySheetEntry.value.quantityUnit}。`;
});
const quantityQuickOptions = computed(() => {
  const entry = quantitySheetEntry.value;
  if (!entry?.quantityValue || entry.quantityValue <= 0) return [];
  return QUANTITY_MULTIPLIERS.map(multiplier => {
    const nextValue = entry.quantityValue! * multiplier;
    return {
      label: buildQuantityText(nextValue, entry.quantityUnit),
      valueText: formatNumber(nextValue)
    };
  });
});
const quantityConfirmDisabled = computed(() => parsePositiveNumber(quantityDraft.value) === null);

onLoad((query) => {
  const rawId = Array.isArray(query?.id) ? query.id[0] : query?.id;
  const rawSource = Array.isArray(query?.from) ? query.from[0] : query?.from;
  listId.value = rawId ? Number(rawId) || "" : "";
  source.value = rawSource === "list" ? "list" : "detail";
  if (!listId.value) {
    errorText.value = "清单不存在";
    return;
  }
  if (!sessionStore.isLoggedIn) return;
  void loadDetail();
});

async function handleLoginSuccess() {
  if (!listId.value) return;
  await loadDetail();
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

async function loadDetail() {
  if (!sessionStore.isLoggedIn || !listId.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const nextDetail = await shoppingApi.getListDetail(listId.value);
    detail.value = nextDetail;
    entries.value = toCompleteEntries(nextDetail.items);
    activeFilter.value = "ALL";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "入库信息加载失败";
  } finally {
    loading.value = false;
  }
}

function toCompleteEntries(items: ShoppingListDetailItem[]): CompleteEntry[] {
  return items
    .filter(item => item.status === "CHECKED")
    .map((item) => {
      const quantityText = (item.remainingQuantityText || item.quantityText || "").trim();
      const quantity = parseQuantityText(quantityText);
      return {
        itemId: item.id,
        name: item.name,
        categoryName: item.categoryName,
        imageUrl: item.imageUrl,
        quantityText,
        quantityValue: quantity.value,
        quantityUnit: quantity.unit,
        store: true,
        confirmed: true,
        expireDays: 7,
        expireAt: null
      };
    });
}

function toggleStore(itemId: UUID) {
  if (submitting.value) return;
  entries.value = entries.value.map(item => (
    item.itemId === itemId
      ? { ...item, store: !item.confirmed, confirmed: !item.confirmed }
      : item
  ));
}

function openQuantitySheet(itemId: UUID) {
  if (submitting.value) return;
  const item = entries.value.find(entry => entry.itemId === itemId);
  if (!item) return;
  quantitySheetItemId.value = itemId;
  quantityDraft.value = item.quantityValue === null ? "" : formatNumber(item.quantityValue);
  quantitySheetVisible.value = true;
}

function openExpireSheet(itemId: UUID) {
  if (submitting.value) return;
  const item = entries.value.find(entry => entry.itemId === itemId);
  if (!item) return;
  const nextDate = resolveExpireDate(item);
  expireSheetItemId.value = itemId;
  expireDraftDate.value = nextDate;
  expireSheetMonth.value = buildMonthAnchor(nextDate);
  expireSheetVisible.value = true;
}

function closeQuantitySheet() {
  quantitySheetVisible.value = false;
}

function closeExpireSheet() {
  expireSheetVisible.value = false;
}

function handleQuantitySheetAfterClose() {
  quantitySheetItemId.value = "";
  quantityDraft.value = "";
}

function handleExpireSheetAfterClose() {
  expireSheetItemId.value = "";
  expireSheetMonth.value = "";
  expireDraftDate.value = "";
}

function applyQuantitySheet() {
  const nextValue = parsePositiveNumber(quantityDraft.value);
  const entry = quantitySheetEntry.value;
  if (!entry || nextValue === null) return;
  applyEntryQuantity(entry.itemId, nextValue);
  closeQuantitySheet();
}

function applyQuantityShortcut(itemId: UUID, quantityValue: number) {
  if (submitting.value) return;
  applyEntryQuantity(itemId, quantityValue);
}

function applyEntryQuantity(itemId: UUID, quantityValue: number) {
  entries.value = entries.value.map(item => (
    item.itemId === itemId
      ? {
          ...item,
          quantityValue,
          quantityText: buildQuantityText(quantityValue, item.quantityUnit),
          confirmed: true,
          store: true
        }
      : item
  ));
}

function applyExpireDate(itemId: UUID, value: string) {
  if (!value || value < todayDate) return;
  entries.value = entries.value.map(item => (
    item.itemId === itemId
      ? {
          ...item,
          expireDays: null,
          expireAt: value,
          confirmed: true,
          store: true
        }
      : item
  ));
}

function handleExpireDateSelect(date: string) {
  expireDraftDate.value = date;
}

function handleExpireMonthChange(monthDate: string) {
  expireSheetMonth.value = monthDate;
}

function applyExpireSheet() {
  if (!expireSheetItemId.value || !expireDraftDate.value) return;
  applyExpireDate(expireSheetItemId.value, expireDraftDate.value);
  closeExpireSheet();
}

function applyExpireShortcut(itemId: UUID, shortcut: ExpireShortcut) {
  if (submitting.value) return;
  entries.value = entries.value.map(item => {
    if (item.itemId !== itemId) return item;
    if (shortcut.unit === "day") {
      return {
        ...item,
        expireDays: shortcut.value,
        expireAt: null,
        confirmed: true,
        store: true
      };
    }
    return {
      ...item,
      expireDays: null,
      expireAt: resolveShortcutDate(shortcut),
      confirmed: true,
      store: true
    };
  });
}

function isExpireShortcutActive(item: CompleteEntry, shortcut: ExpireShortcut) {
  if (shortcut.unit === "day") {
    return !item.expireAt && (item.expireDays ?? 7) === shortcut.value;
  }
  return item.expireAt === resolveShortcutDate(shortcut);
}

function resolveExpireDate(item: CompleteEntry) {
  if (item.expireAt) return item.expireAt;
  return resolveShortcutDate({
    key: `day-${item.expireDays ?? 7}`,
    label: "",
    unit: "day",
    value: item.expireDays ?? 7
  });
}

function resolveShortcutDate(shortcut: ExpireShortcut) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (shortcut.unit === "day") {
    date.setDate(date.getDate() + shortcut.value);
    return formatDate(date);
  }
  if (shortcut.unit === "month") {
    date.setMonth(date.getMonth() + shortcut.value);
    return formatDate(date);
  }
  date.setFullYear(date.getFullYear() + shortcut.value);
  return formatDate(date);
}

function quantityDisplay(item: CompleteEntry) {
  return item.quantityText || "未填数量";
}

function quantityShortcutOptions(item: CompleteEntry) {
  if (!item.quantityValue || item.quantityValue <= 0) return [];
  return QUANTITY_MULTIPLIERS.map(multiplier => {
    const nextValue = item.quantityValue! * multiplier;
    return {
      value: nextValue,
      label: buildQuantityText(nextValue, item.quantityUnit)
    };
  });
}

function parseQuantityText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      value: null,
      unit: ""
    };
  }
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) {
    return {
      value: null,
      unit: ""
    };
  }
  return {
    value: parsePositiveNumber(match[1]),
    unit: match[2]?.trim() || ""
  };
}

function parsePositiveNumber(value: string) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) return null;
  return nextValue;
}

function buildQuantityText(value: number, unit: string) {
  return `${formatNumber(value)}${unit}`;
}

function formatNumber(value: number) {
  return `${Number(value.toFixed(3))}`;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildMonthAnchor(dateText: string) {
  const [year = "", month = ""] = dateText.split("-");
  if (!year || !month) return `${todayDate.slice(0, 7)}-01`;
  return `${year}-${month}-01`;
}

async function submitComplete() {
  if (!detail.value || submitting.value) return;
  submitting.value = true;
  try {
    const nextDetail = await shoppingApi.completeList(detail.value.id, {
      operationId: createOperationId(),
      version: detail.value.version,
      entries: entries.value.map(item => ({
        itemId: item.itemId,
        store: item.store,
        quantityText: item.quantityText.trim() || null,
        expireDays: item.expireAt ? null : item.expireDays,
        expireAt: item.expireAt
      }))
    });
    stashShoppingCompleteResult(source.value, nextDetail);
    await uniPlatform.feedback.toast({ title: storeCount.value ? "已完成并入库" : "已完成清单", icon: "success" });
    await goBack();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function goBack() {
  try {
    await uniPlatform.navigation.navigateBack();
  } catch {
    if (listId.value && source.value === "detail") {
      await uniPlatform.navigation.redirectTo(`/pages_pantry/list-detail/index?id=${encodeURIComponent(String(listId.value))}`);
      return;
    }
    await uniPlatform.navigation.redirectTo("/pages_pantry/list/index");
  }
}
</script>

<style scoped lang="scss">
.complete-page,
.complete-scroll {
  height: 100%;
}

.complete-page {
  position: relative;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-page) 84%, var(--color-primary-soft) 16%) 0%, var(--color-page) 48%, var(--color-page) 100%);
}

.complete-nav,
.complete-card__head,
.complete-card__summary,
.field-block__row,
.field-block__chips,
.quantity-sheet__input-wrap,
.sheet-actions {
  display: flex;
}

.complete-nav,
.complete-card__head,
.field-block__row,
.sheet-actions {
  justify-content: space-between;
}

.complete-card__summary,
.field-block__chips,
.quantity-sheet__input-wrap {
  align-items: center;
}

.complete-nav,
.field-block__row,
.sheet-actions {
  align-items: center;
}

.complete-card__head,
.complete-card__summary {
  align-items: stretch;
}

.complete-nav {
  gap: 18rpx;
  min-width: 0;
}

.complete-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 790;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-surface-mask-strong) 82%, var(--color-surface) 18%) 0%, color-mix(in srgb, var(--color-surface) 92%, transparent) 100%);
  box-shadow: 0 10rpx 26rpx color-mix(in srgb, var(--color-surface-mask-medium) 64%, transparent);
  pointer-events: none;
  transition: opacity 180ms ease;
}

.complete-nav__back,
.complete-nav__title {
  color: var(--color-text);
}

.complete-nav__back {
  font-size: 32rpx;
}

.complete-nav__back--hover {
  opacity: 0.82;
}

.complete-nav__title {
  overflow: hidden;
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease;
}

.complete-body {
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.complete-hero {
  --complete-hero-end: var(--color-page);

  position: relative;
  overflow: hidden;
  min-height: 420rpx;
  padding-right: 32rpx;
  padding-bottom: 148rpx;
  padding-left: 32rpx;
  border-bottom-right-radius: 56rpx;
  border-bottom-left-radius: 56rpx;
  background:
    radial-gradient(circle at 18% 18%, var(--entry-side-mint-bg) 0, transparent 30%),
    radial-gradient(circle at 82% 14%, var(--entry-side-aqua-bg) 0, transparent 30%),
    linear-gradient(148deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.complete-hero::before {
  position: absolute;
  top: 88rpx;
  right: -72rpx;
  z-index: 1;
  width: 304rpx;
  height: 216rpx;
  border-radius: 50%;
  background: var(--color-surface-mask-weak);
  content: "";
  pointer-events: none;
  transform: rotate(-14deg);
}

.complete-hero::after {
  --complete-mask-solid: #000;
  --complete-mask-strong: rgba(0, 0, 0, 0.76);
  --complete-mask-mid: rgba(0, 0, 0, 0.42);

  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 228rpx;
  background: var(--complete-hero-end);
  content: "";
  mask-image:
    radial-gradient(ellipse at 15% 100%,
      var(--complete-mask-solid) 0%,
      var(--complete-mask-strong) 36%,
      transparent 72%),
    radial-gradient(ellipse at 85% 100%,
      var(--complete-mask-solid) 0%,
      var(--complete-mask-strong) 36%,
      transparent 72%),
    linear-gradient(to bottom,
      transparent 0%,
      var(--complete-mask-mid) 50%,
      var(--complete-mask-solid) 100%);
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
}

.complete-hero__title,
.complete-hero__desc,
.complete-card__title,
.complete-card__category,
.complete-card__state,
.field-block__label,
.field-block__hint,
.field-block__value,
.notice,
.quantity-sheet__name,
.quantity-sheet__meta,
.quantity-sheet__label,
.quantity-sheet__unit {
  display: block;
}

.complete-hero__title,
.complete-hero__desc {
  position: relative;
  z-index: 2;
}

.complete-hero__title {
  color: var(--color-text);
  font-size: 44rpx;
  line-height: 1.24;
  font-weight: var(--font-weight-heavy);
}

.complete-hero__desc {
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: 27rpx;
  line-height: 1.7;
}

.complete-content {
  position: relative;
  z-index: 2;
  margin-top: -92rpx;
  padding: 0 28rpx;
}

.complete-panel {
  position: relative;
}

.complete-filter,
.complete-card,
.complete-empty,
.field-block,
.complete-footer,
.quantity-sheet__editor {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.complete-empty,
.complete-list {
  margin-top: 24rpx;
}

.complete-filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  -webkit-backdrop-filter: saturate(180%) blur(18rpx);
  backdrop-filter: saturate(180%) blur(18rpx);
}

.complete-filter__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 120rpx;
  padding: 28rpx 12rpx;
  background: color-mix(in srgb, var(--color-surface) 90%, var(--color-page) 10%);
}

.complete-filter__item--active {
  background: color-mix(in srgb, var(--color-primary-soft) 18%, var(--color-surface) 82%);
}

.complete-filter__item + .complete-filter__item::before {
  content: "";
  position: absolute;
  top: 28rpx;
  bottom: 28rpx;
  left: 0;
  width: 1rpx;
  background: var(--color-border);
}

.complete-filter__label,
.complete-filter__count {
  display: block;
}

.complete-filter__count {
  color: var(--color-text);
  font-size: 52rpx;
  line-height: 1;
  font-weight: var(--font-weight-heavy);
}

.complete-filter__count--accent {
  color: #d6a108;
}

.complete-filter__label {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.complete-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.complete-card {
  padding: 28rpx;
}

.complete-card--pending {
  box-shadow:
    0 18rpx 34rpx color-mix(in srgb, var(--color-primary-soft) 18%, transparent),
    var(--shadow-card);
}

.complete-card__summary {
  flex: 1;
  min-width: 0;
  gap: 18rpx;
  min-height: 112rpx;
}

.complete-card__cover {
  flex: 0 0 112rpx;
  width: 112rpx;
  height: 112rpx;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: color-mix(in srgb, var(--color-page) 72%, var(--color-surface) 28%);
}

.complete-card__image,
.complete-card__placeholder {
  width: 100%;
  height: 100%;
}

.complete-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-page) 82%, var(--color-primary-soft) 18%) 0%, var(--color-page) 100%);
}

.complete-card__info {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  min-height: 112rpx;
}

.complete-card__title {
  color: var(--color-text);
  font-size: 32rpx;
  line-height: 1.34;
  font-weight: var(--font-weight-heavy);
}

.complete-card__meta {
  display: flex;
  align-items: center;
  min-height: 36rpx;
}

.complete-card__category,
.complete-card__state {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.complete-card__state {
  color: var(--color-primary);
  margin-bottom: 8rpx;
  font-size: 22rpx;
  line-height: 1.2;
}

.complete-card__dot {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1;
}

.complete-card__toggle {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 112rpx;
  min-width: 92rpx;
  padding: 0;
}

.complete-card__toggle-icon {
  color: var(--color-text-quaternary);
  line-height: 1;
}

.complete-card__toggle .icon-select-on {
  color: var(--color-primary);
}

.complete-card__fields {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}

.field-block {
  padding: 24rpx;
}

.field-block--action {
  cursor: pointer;
}

.field-block__row {
  gap: 24rpx;
}

.field-block__row--picker {
  min-height: 80rpx;
}

.field-block__main {
  flex: 1;
  min-width: 0;
}

.field-block__label {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.35;
  font-weight: var(--font-weight-heavy);
}

.field-block__hint {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: 20rpx;
  line-height: 1.4;
}

.field-block__value {
  flex: 0 0 auto;
  min-width: 132rpx;
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.5;
  font-weight: var(--font-weight-heavy);
  text-align: right;
  border-bottom: 4rpx solid var(--color-text-tertiary);
}

.field-block__chips {
  margin-top: 22rpx;
}

.field-block__chips--row {
  display: inline-flex;
  flex-wrap: nowrap;
  gap: 12rpx;
  min-width: max-content;
  padding-right: 12rpx;
}

.field-block__scroll {
  width: 100%;
  margin-top: 2rpx;
  white-space: nowrap;
}

.quick-chip {
  flex: 0 0 auto;
  padding: 10rpx 20rpx;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-page) 76%, var(--color-surface) 24%);
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.2;
}

.quick-chip--active {
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--color-surface) 66%);
  color: var(--color-primary);
  font-weight: var(--font-weight-heavy);
}

.complete-footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  background: var(--color-surface);
  box-shadow: var(--shadow-floating);
  -webkit-backdrop-filter: blur(12rpx);
  backdrop-filter: blur(12rpx);
}

.complete-footer__button,
.sheet-actions__button {
  border: none;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
}

.complete-footer__button {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  color: var(--button-primary-text);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}

.complete-footer__main {
  width: 100%;
  min-width: 0;
}

.quantity-sheet {
  padding-top: 12rpx;
}

.expire-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-top: 12rpx;
}

.expire-sheet__hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}

.expire-sheet__label,
.expire-sheet__value {
  display: block;
}

.expire-sheet__label {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1;
}

.expire-sheet__value {
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1.3;
  font-weight: var(--font-weight-heavy);
  text-align: right;
}

.quantity-sheet__hero,
.quantity-sheet__editor {
  padding: 24rpx 26rpx;
}

.quantity-sheet__hero {
  padding-right: 6rpx;
  padding-left: 6rpx;
}

.quantity-sheet__editor,
.quantity-sheet__shortcuts {
  margin-top: 18rpx;
}

.quantity-sheet__name {
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.4;
  font-weight: var(--font-weight-heavy);
}

.quantity-sheet__meta,
.quantity-sheet__label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.quantity-sheet__meta {
  margin-top: 8rpx;
}

.quantity-sheet__input-wrap {
  gap: 16rpx;
  margin-top: 18rpx;
  padding: 0 6rpx 12rpx;
  border-bottom: 1rpx solid color-mix(in srgb, var(--color-divider) 82%, transparent);
}

.quantity-sheet__input {
  flex: 1;
  min-width: 0;
  height: 60rpx;
  color: var(--color-text);
  font-size: 42rpx;
  line-height: 60rpx;
  font-weight: var(--font-weight-heavy);
}

.quantity-sheet__unit {
  flex: 0 0 auto;
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 60rpx;
}

.quantity-sheet__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.sheet-actions {
  gap: 18rpx;
}

.sheet-actions__button {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
}

.sheet-actions__button--cancel {
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-page) 80%, var(--color-surface) 20%);
}

.sheet-actions__button--confirm {
  color: var(--button-primary-text);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
}

.notice {
  padding: 80rpx 32rpx;
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1.6;
  text-align: center;
}
</style>
