<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="detail-nav__title" :style="navTitleStyle">{{ currentItem?.name || "食材详情" }}</text>
    </template>

    <view class="detail-nav-backdrop" :style="navBackdropStyle" />

    <view class="detail-scroll-wrap">
      <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false" @scroll="handleScroll">
        <view class="detail-page">
          <view class="detail-hero" :style="heroStyle">
            <view class="detail-hero__avatar">
              <image v-if="itemImageUrl" class="detail-hero__image" :src="itemImageUrl" mode="aspectFill" />
              <text v-else class="detail-hero__avatar-text">{{ currentItem ? buildIngredientAvatarText(currentItem.name) : "食" }}</text>
            </view>
            <text class="detail-hero__eyebrow">库存食材</text>
            <text class="detail-hero__title">{{ currentItem?.name || "食材详情" }}</text>
            <text class="detail-hero__stock">{{ stockSummary }}</text>
            <text class="detail-hero__description">{{ expireSummary }}</text>
            <view v-if="currentItem" class="badge-row">
              <text v-if="isExpiringSoon(currentItem.expireAt)" class="badge badge--warning">{{ formatExpireLabel(currentItem.expireAt) }}</text>
              <text v-if="hasReservations(currentItem)" class="badge badge--info">预占中</text>
              <text v-if="needsExact(currentItem)" class="badge badge--muted">待补精确数量</text>
            </view>
          </view>

          <view class="detail-content">
            <Login v-if="!sessionStore.isLoggedIn" title="登录后查看食材详情" description="库存条目只归你本人所有。" />

            <template v-else>
              <view v-if="errorText" class="notice" @click="loadContext">
                <text class="notice__text">{{ errorText }}</text>
                <text class="notice__action">重新加载</text>
              </view>

              <view v-else-if="loading" class="notice">
                <text class="notice__text">正在加载库存详情...</text>
              </view>

              <Empty
                v-else-if="!currentItem"
                title="没找到这条库存"
                description="它可能已经被删除，或刚刚被其他操作修改了。"
              />

              <template v-else>
                <view class="section-card">
                  <view class="section-card__header">
                    <text class="section-card__title">库存概览</text>
                    <text class="section-card__hint">这里只管理你自己的库存事实，不改系统食材资料。</text>
                  </view>
                  <view v-if="showExactMetrics" class="metric-grid">
                    <view class="metric-card">
                      <text class="metric-card__label">实际库存</text>
                      <text class="metric-card__value">{{ currentItem.stockText || "-" }}</text>
                    </view>
                    <view class="metric-card">
                      <text class="metric-card__label">已预占</text>
                      <text class="metric-card__value">{{ currentItem.reservedText || zeroReservedText }}</text>
                    </view>
                    <view class="metric-card">
                      <text class="metric-card__label">可用库存</text>
                      <text class="metric-card__value">{{ currentItem.availableText || "-" }}</text>
                    </view>
                  </view>
                  <view v-else class="info-list">
                    <view class="info-row">
                      <text class="info-row__label">当前库存</text>
                      <text class="info-row__value">{{ currentItem.stockText || currentItem.quantityText || "未填数量" }}</text>
                    </view>
                  </view>
                  <view class="info-list">
                    <view class="info-row">
                      <text class="info-row__label">到期时间</text>
                      <text class="info-row__value">{{ currentItem.expireAt ? currentItem.expireAt.slice(0, 10) : "未设置" }}</text>
                    </view>
                    <view class="info-row">
                      <text class="info-row__label">备注</text>
                      <text class="info-row__value">{{ currentItem.note || "暂无备注" }}</text>
                    </view>
                  </view>
                </view>

                <view v-if="currentItem.reservations.length" class="section-card">
                  <view class="section-card__header">
                    <text class="section-card__title">预占明细</text>
                    <text class="section-card__hint">这些库存已经被购物清单暂时占用，但还没有正式结算。</text>
                  </view>
                  <view class="reservation-list">
                    <view
                      v-for="reservation in currentItem.reservations"
                      :key="`${currentItem.id}-${reservation.shoppingItemId}`"
                      class="reservation-row"
                    >
                      <view class="reservation-row__main">
                        <text class="reservation-row__title">{{ reservation.shoppingListName }}</text>
                        <text class="reservation-row__meta">购物项 {{ reservation.shoppingItemId }}</text>
                      </view>
                      <text class="reservation-row__value">{{ reservation.reservedText }}</text>
                    </view>
                  </view>
                </view>

                <view class="section-card">
                  <view class="section-card__header">
                    <text class="section-card__title">库存操作</text>
                    <text class="section-card__hint">编辑库存、补货和扣减都在这里处理。</text>
                  </view>
                  <view class="action-grid">
                    <view class="action-button" hover-class="action-button--hover" hover-stay-time="100" @click="openEdit">
                      <text class="action-button__title">编辑库存</text>
                      <text class="action-button__meta">修改库存、到期时间和备注</text>
                    </view>
                    <view class="action-button" hover-class="action-button--hover" hover-stay-time="100" @click="openRestock">
                      <text class="action-button__title">补货</text>
                      <text class="action-button__meta">继续补这项食材的库存</text>
                    </view>
                    <view
                      class="action-button action-button--accent"
                      :class="{ 'action-button--disabled': consuming }"
                      hover-class="action-button--hover"
                      hover-stay-time="100"
                      @click="consumeCurrent"
                    >
                      <text class="action-button__title">{{ consuming ? "处理中..." : "扣减" }}</text>
                      <text class="action-button__meta">快速扣减当前库存</text>
                    </view>
                  </view>
                </view>

                <view class="section-card">
                  <view class="section-card__header">
                    <text class="section-card__title">采购补货</text>
                    <text class="section-card__hint">需要补货时，直接把这项食材加到购物清单。</text>
                  </view>
                  <view class="shopping-card" hover-class="shopping-card--hover" hover-stay-time="100" @click="openShoppingSheet">
                    <view class="shopping-card__main">
                      <text class="shopping-card__title">加入购物清单</text>
                      <text class="shopping-card__meta">可选现有活跃清单，也可现场新建一张清单。</text>
                    </view>
                    <text class="shopping-card__arrow">›</text>
                  </view>
                </view>
              </template>
            </template>
          </view>
        </view>
      </scroll-view>
    </view>

    <SheetShell
      :visible="shoppingSheetVisible"
      title="加入购物清单"
      subtitle="这次先只处理单食材补货，不改系统食材信息。"
      @close="closeShoppingSheet"
      @after-close="resetShoppingSheet"
    >
      <view class="sheet-section">
        <text class="sheet-section__title">目标清单</text>
        <view v-if="activeShoppingLists.length" class="sheet-option-list">
          <view
            v-for="list in activeShoppingLists"
            :key="list.id"
            class="sheet-option"
            :class="{ 'sheet-option--active': !shoppingCreateMode && selectedListId === list.id }"
            @click="selectActiveList(list.id)"
          >
            <view class="sheet-option__main">
              <text class="sheet-option__title">{{ list.name }}</text>
              <text class="sheet-option__meta">剩余 {{ Math.max(list.progressTotalCount - list.progressDoneCount, 0) }} 项待处理</text>
            </view>
          </view>
        </view>
        <view class="sheet-option" :class="{ 'sheet-option--active': shoppingCreateMode }" @click="shoppingCreateMode = true">
          <view class="sheet-option__main">
            <text class="sheet-option__title">新建购物清单</text>
            <text class="sheet-option__meta">没有合适的清单时，直接在这里新建。</text>
          </view>
        </view>
        <input
          v-if="shoppingCreateMode"
          v-model="newListName"
          class="sheet-input"
          maxlength="20"
          placeholder="请输入新清单名"
        />
      </view>

      <view class="sheet-section">
        <text class="sheet-section__title">采购信息</text>
        <input v-model="shoppingQuantityText" class="sheet-input" placeholder="采购数量，可留空，例如 2 盒 / 500 克" />
        <input v-model="shoppingNote" class="sheet-input" placeholder="备注，可留空，例如 补周末做饭用量" />
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="shoppingSubmitting" @click="closeShoppingSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="shoppingSubmitDisabled" @click="submitShopping">
            {{ shoppingSubmitting ? "加入中..." : "加入清单" }}
          </button>
        </view>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { fridgeApi, type FridgeItemSummary } from "../apis/fridge";
import { shoppingApi, type ShoppingListSummary } from "../apis/shopping";
import { buildIngredientAvatarText, formatExpireLabel, isExpiringSoon, resolveFridgeImageMap } from "../utils/fridge";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();

const HERO_TOP_GAP = 16;
const NAV_FADE_DISTANCE = 96;

const itemId = ref<UUID | "">("");
const loading = ref(false);
const consuming = ref(false);
const errorText = ref("");
const scrollTop = ref(0);
const currentItem = ref<FridgeItemSummary | null>(null);
const itemImageUrl = ref("");
const shoppingSheetVisible = ref(false);
const shoppingSubmitting = ref(false);
const shoppingCreateMode = ref(false);
const activeShoppingLists = ref<ShoppingListSummary[]>([]);
const selectedListId = ref<UUID | "">("");
const newListName = ref("");
const shoppingQuantityText = ref("");
const shoppingNote = ref("");

const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + HERO_TOP_GAP}px`
}));
const showExactMetrics = computed(() => Boolean(currentItem.value?.exactQuantity && currentItem.value?.exactUnitName));
const zeroReservedText = computed(() => (currentItem.value?.exactUnitName ? `0 ${currentItem.value.exactUnitName}` : "0"));
const stockSummary = computed(() => {
  if (!currentItem.value) return "未找到库存";
  return currentItem.value.stockText || currentItem.value.quantityText || "未填数量";
});
const expireSummary = computed(() => {
  if (!currentItem.value) return "请返回上一页重试";
  return currentItem.value.expireAt ? formatExpireLabel(currentItem.value.expireAt) : `更新于 ${currentItem.value.updatedAt.slice(5, 10)}`;
});
const shoppingSubmitDisabled = computed(() => {
  if (shoppingSubmitting.value || !currentItem.value) return true;
  if (shoppingCreateMode.value) return !newListName.value.trim();
  return !selectedListId.value;
});

onLoad(options => {
  if (typeof options?.itemId === "string" && options.itemId) {
    const parsed = Number(options.itemId);
    itemId.value = Number.isInteger(parsed) && parsed > 0 ? parsed : "";
  }
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadContext();
});

async function loadContext() {
  if (!sessionStore.isLoggedIn || loading.value || !itemId.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await fridgeApi.list(1, 100);
    const nextItem = result.items.find(item => item.id === itemId.value) ?? null;
    currentItem.value = nextItem;
    if (!nextItem) {
      throw new Error("库存条目不存在");
    }
    const imageMap = await resolveFridgeImageMap([nextItem], 1);
    itemImageUrl.value = imageMap[String(nextItem.id)] || "";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "食材详情加载失败";
  } finally {
    loading.value = false;
  }
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function hasReservations(item: FridgeItemSummary) {
  return item.reservations.length > 0;
}

function needsExact(item: FridgeItemSummary) {
  return !item.exactQuantity || !item.exactUnitId;
}

function openEdit() {
  if (!currentItem.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_pantry/item-edit/index?itemId=${encodeURIComponent(String(currentItem.value.id))}`);
}

function openRestock() {
  openEdit();
}

async function consumeCurrent() {
  if (!currentItem.value || consuming.value) return;
  consuming.value = true;
  try {
    await fridgeApi.consume([currentItem.value.id], createOperationId());
    await uniPlatform.feedback.toast({ title: "已扣减", icon: "success" });
    await loadContext();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "扣减失败", icon: "none" });
  } finally {
    consuming.value = false;
  }
}

async function openShoppingSheet() {
  if (!currentItem.value) return;
  try {
    const result = await shoppingApi.listLists("ACTIVE");
    activeShoppingLists.value = result.items;
    shoppingCreateMode.value = !result.items.length;
    selectedListId.value = result.items[0]?.id || "";
    shoppingSheetVisible.value = true;
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "购物清单加载失败", icon: "none" });
  }
}

function closeShoppingSheet() {
  shoppingSheetVisible.value = false;
}

function resetShoppingSheet() {
  shoppingSubmitting.value = false;
  shoppingCreateMode.value = false;
  selectedListId.value = activeShoppingLists.value[0]?.id || "";
  newListName.value = "";
  shoppingQuantityText.value = "";
  shoppingNote.value = "";
}

function selectActiveList(listId: UUID) {
  shoppingCreateMode.value = false;
  selectedListId.value = listId;
}

async function submitShopping() {
  if (!currentItem.value || shoppingSubmitDisabled.value) return;
  shoppingSubmitting.value = true;
  try {
    let targetListId = selectedListId.value;
    if (shoppingCreateMode.value) {
      const createdList = await shoppingApi.createList({
        operationId: createOperationId(),
        name: newListName.value.trim()
      });
      targetListId = createdList.id;
    }
    if (!targetListId) {
      throw new Error("请选择购物清单");
    }
    await shoppingApi.createListItem(targetListId, {
      operationId: createOperationId(),
      name: currentItem.value.name,
      ingredientId: currentItem.value.ingredientId,
      quantityText: shoppingQuantityText.value.trim() || null,
      note: shoppingNote.value.trim() || null
    });
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    closeShoppingSheet();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.detail-nav__title {
  max-width: 420rpx;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease;
}

.detail-scroll-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
}

.detail-scroll {
  height: 100%;
  background: var(--color-page);
}

.detail-page {
  min-height: 100%;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.detail-hero {
  padding: 60rpx var(--space-page) 160rpx;
  background:
    linear-gradient(180deg, rgba(255, 251, 244, 0.88), rgba(248, 243, 235, 0.96)),
    radial-gradient(circle at 18% 18%, rgba(255, 216, 156, 0.5), transparent 28%),
    radial-gradient(circle at 82% 20%, rgba(176, 216, 184, 0.34), transparent 26%),
    radial-gradient(circle at 66% 76%, rgba(255, 234, 198, 0.28), transparent 24%);
}

.detail-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.detail-hero__avatar,
.detail-hero__eyebrow,
.detail-hero__title,
.detail-hero__stock,
.detail-hero__description,
.badge,
.notice__text,
.notice__action,
.section-card__title,
.section-card__hint,
.metric-card__label,
.metric-card__value,
.info-row__label,
.info-row__value,
.reservation-row__title,
.reservation-row__meta,
.reservation-row__value,
.action-button__title,
.action-button__meta,
.shopping-card__title,
.shopping-card__meta,
.shopping-card__arrow,
.sheet-section__title,
.sheet-option__title,
.sheet-option__meta {
  display: block;
}

.detail-hero__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 148rpx;
  height: 148rpx;
  border-radius: 40rpx;
  background:
    linear-gradient(180deg, rgba(255, 250, 241, 0.96), rgba(244, 239, 229, 0.96)),
    radial-gradient(circle at 28% 26%, rgba(255, 219, 156, 0.52), transparent 34%);
  overflow: hidden;
}

.detail-hero__image {
  width: 100%;
  height: 100%;
}

.detail-hero__avatar-text {
  color: var(--color-primary);
  font-size: 56rpx;
  font-weight: var(--font-weight-heavy);
}

.detail-hero__eyebrow {
  margin-top: 24rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  letter-spacing: 0.12em;
}

.detail-hero__title {
  margin-top: 14rpx;
  color: var(--color-text);
  font-size: 58rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.18;
}

.detail-hero__stock {
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.detail-hero__description {
  margin-top: 12rpx;
  max-width: 620rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.65;
}

.badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
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

.notice,
.section-card {
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice {
  padding: var(--space-md);
}

.notice__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.notice__action {
  margin-top: 8rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
}

.section-card + .section-card,
.notice + .section-card {
  margin-top: var(--space-md);
}

.section-card {
  padding: var(--space-md);
}

.section-card__header {
  margin-bottom: var(--space-md);
}

.section-card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.section-card__hint {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-sm);
}

.metric-card,
.info-row,
.reservation-row,
.action-button,
.shopping-card,
.sheet-option {
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.metric-card {
  min-height: 150rpx;
  padding: 22rpx 20rpx;
}

.metric-card__label,
.info-row__label,
.reservation-row__meta,
.action-button__meta,
.shopping-card__meta,
.sheet-option__meta {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.metric-card__value,
.info-row__value,
.reservation-row__title,
.reservation-row__value,
.action-button__title,
.shopping-card__title,
.sheet-option__title {
  color: var(--color-text);
}

.metric-card__value {
  margin-top: 10rpx;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.info-list + .info-list {
  margin-top: var(--space-sm);
}

.info-row,
.reservation-row,
.shopping-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: 22rpx 20rpx;
}

.info-row__label,
.info-row__value {
  flex: 1;
}

.info-row__value {
  text-align: right;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.reservation-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.reservation-row__main {
  flex: 1;
  min-width: 0;
}

.reservation-row__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.reservation-row__meta {
  margin-top: 6rpx;
}

.reservation-row__value {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
}

.action-button {
  min-height: 168rpx;
  padding: 24rpx 20rpx;
}

.action-button--accent {
  background: linear-gradient(180deg, rgba(250, 244, 232, 0.96), rgba(255, 250, 243, 0.98));
}

.action-button--disabled {
  opacity: 0.66;
}

.action-button--hover,
.shopping-card--hover {
  opacity: 0.92;
}

.action-button__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.action-button__meta {
  margin-top: 10rpx;
  line-height: 1.6;
}

.shopping-card__main {
  flex: 1;
  min-width: 0;
}

.shopping-card__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.shopping-card__meta {
  margin-top: 8rpx;
  line-height: 1.6;
}

.shopping-card__arrow {
  color: var(--color-text-tertiary);
  font-size: 38rpx;
  line-height: 1.2;
}

.sheet-section + .sheet-section {
  margin-top: 28rpx;
}

.sheet-section__title {
  margin-bottom: 18rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.sheet-option-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.sheet-option {
  padding: 22rpx 20rpx;
}

.sheet-option + .sheet-input,
.sheet-input + .sheet-input {
  margin-top: 12rpx;
}

.sheet-option--active {
  background: var(--color-primary-soft);
}

.sheet-input {
  min-height: 88rpx;
  margin-top: 12rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.sheet-actions__button {
  height: 88rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button--cancel {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
}
</style>
