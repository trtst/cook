<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="detail-nav__title" :style="navTitleStyle">{{ currentItem?.name || "食材详情" }}</text>
    </template>

    <view class="detail-nav-backdrop" :style="navBackdropStyle" />

    <view class="detail-page">
      <scroll-view scroll-y class="detail-content-scroll" show-scrollbar="false" @scroll="handleScroll">
        <view class="detail-content">
          <view v-if="sessionStore.isLoggedIn && currentItem" class="detail-hero">
            <view class="detail-hero__cover">
              <ImageLoader class="detail-hero__image" :src="itemImageUrl" />
            </view>
            <view class="summary-card">
              <text class="summary-card__eyebrow">厨房小管家</text>
              <text class="summary-card__title">{{ currentItem.name }}</text>
              <text class="summary-card__stock">{{ stockSummary }}</text>
              <text class="summary-card__description">{{ expireSummary }}</text>
              <view class="badge-row">
                <text v-if="currentItem.expiredBatchCount" class="badge badge--warning">已过期 {{ currentItem.expiredBatchCount }} 批</text>
                <text v-if="currentItem.needsConfirmation" class="badge badge--muted">有库存待补精确数量</text>
              </view>
            </view>
          </view>

          <Empty
            v-if="!sessionStore.isLoggedIn"
            :art="emptyStateArt"
            title="登录后查看食材详情"
            description="库存条目只归你本人所有。"
            clickable
            @click="openLogin"
          />

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
              title="没找到这份食材"
              description="它可能已经被删除，或刚刚被其他操作修改了。"
            />

            <template v-else>
              <view v-if="!currentItem.identityPending" class="section-card">
                <view class="section-card__header">
                  <text class="section-card__title">现在还剩多少</text>
                  <text class="section-card__hint">这里看总库存和到期提醒，批次细节往下看。</text>
                </view>
                <view class="info-list">
                  <view class="info-row">
                    <text class="info-row__label">当前库存</text>
                    <text class="info-row__value">{{ currentItem.stockText }}</text>
                  </view>
                  <view class="info-row">
                    <text class="info-row__label">批次数</text>
                    <text class="info-row__value">{{ currentItem.batchCount }} 批</text>
                  </view>
                </view>
              </view>

              <view v-if="currentItem.activeBatches.length" class="section-card">
                <view class="section-card__header">
                  <text class="section-card__title">当前批次</text>
                  <text class="section-card__hint">按到期时间优先排列，做饭时直接扣减总量。</text>
                </view>
                <view class="batch-list">
                  <view v-for="batch in currentItem.activeBatches" :key="batch.id" class="batch-row">
                    <view class="batch-row__main">
                      <text class="batch-row__title">{{ batch.stockText || batch.quantityText || "未填数量" }}</text>
                      <text class="batch-row__meta">{{ batch.expireAt ? formatExpireLabel(batch.expireAt) : "未设置到期时间" }}</text>
                    </view>
                    <view class="batch-row__side">
                      <text v-if="batch.reservedText" class="batch-row__value">预占 {{ batch.reservedText }}</text>
                      <text class="batch-row__edit" @click.stop="openBatchEdit(batch.id)">补充数量</text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="currentItem.expiredBatches.length" class="section-card">
                <view class="collapse-header" @click="showExpired = !showExpired">
                  <view>
                    <text class="section-card__title">已过期库存 · {{ currentItem.expiredBatches.length }} 批</text>
                    <text class="section-card__hint">过期只是提醒，确认还能用时仍可扣减。</text>
                  </view>
                  <text class="collapse-header__arrow">{{ showExpired ? "收起" : "展开" }}</text>
                </view>
                <view v-if="showExpired" class="batch-list">
                  <view v-for="batch in currentItem.expiredBatches" :key="batch.id" class="batch-row batch-row--expired">
                    <view class="batch-row__main">
                      <text class="batch-row__title">{{ batch.stockText || batch.quantityText || "未填数量" }}</text>
                      <text class="batch-row__meta">{{ formatExpireLabel(batch.expireAt) }}</text>
                    </view>
                    <view class="batch-row__side">
                      <text v-if="batch.reservedText" class="batch-row__value">预占 {{ batch.reservedText }}</text>
                      <text class="batch-row__edit" @click.stop="openBatchEdit(batch.id)">补充数量</text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="!currentItem.identityPending" class="section-card">
                <view class="collapse-header" @click="toggleHistory">
                  <view>
                    <text class="section-card__title">历史批次</text>
                    <text class="section-card__hint">已用完的批次默认收起，需要时再查询。</text>
                  </view>
                  <text class="collapse-header__arrow">{{ showHistory ? "收起" : historyLoading ? "查询中" : "查询" }}</text>
                </view>
                <view v-if="showHistory" class="batch-list">
                  <view v-for="batch in historyBatches" :key="batch.id" class="batch-row">
                    <view class="batch-row__main">
                      <text class="batch-row__title">{{ batch.stockText || batch.quantityText || "已用完" }}</text>
                      <text class="batch-row__meta">入库于 {{ batch.createdAt.slice(0, 10) }}</text>
                    </view>
                    <text class="batch-row__value">已用完</text>
                  </view>
                  <view v-if="historyHasNext && !historyLoading" class="history-more" @click="loadMoreHistory">
                    <text class="history-more__text">加载更多历史</text>
                  </view>
                  <text v-if="historyLoading && historyBatches.length" class="section-card__hint">正在加载更多历史...</text>
                  <text v-if="!historyBatches.length && !historyLoading" class="section-card__hint">还没有历史批次</text>
                </view>
              </view>

              <view class="section-card">
                <view class="section-card__header">
                  <text class="section-card__title">库存操作</text>
                  <text class="section-card__hint">只记总量，系统会自动按最早到期批次扣减。</text>
                </view>
                <view class="action-grid">
                  <view class="action-button" hover-class="action-button--hover" hover-stay-time="100" @click="openRestock">
                    <text class="action-button__title">新增库存</text>
                    <text class="action-button__meta">这次买了新的就新增一批</text>
                  </view>
                  <view
                    class="action-button action-button--accent"
                    :class="{ 'action-button--disabled': consuming }"
                    hover-class="action-button--hover"
                    hover-stay-time="100"
                    @click="openConsumeSheet"
                  >
                    <text class="action-button__title">{{ consuming ? "处理中..." : "扣减库存" }}</text>
                    <text class="action-button__meta">做饭或手动用掉一部分</text>
                  </view>
                </view>
                <view class="action-grid action-grid--status">
                  <view
                    class="action-button action-button--status"
                    :class="{ 'action-button--disabled': correcting }"
                    hover-class="action-button--hover"
                    hover-stay-time="100"
                    @click="markFridgeState('ROUGH')"
                  >
                    <text class="action-button__title">快用完</text>
                    <text class="action-button__meta">保留食材，但不再精算数量</text>
                  </view>
                  <view
                    class="action-button action-button--status action-button--danger"
                    :class="{ 'action-button--disabled': correcting }"
                    hover-class="action-button--hover"
                    hover-stay-time="100"
                    @click="markFridgeState('EMPTY')"
                  >
                    <text class="action-button__title">用完</text>
                    <text class="action-button__meta">从当前库存移出，历史仍可查询</text>
                  </view>
                </view>
              </view>

              <view class="section-card">
                <view class="section-card__header">
                  <text class="section-card__title">需要再买时</text>
                  <text class="section-card__hint">采购只是记录待买项，不会直接扣减库存。</text>
                </view>
                <view class="shopping-card" hover-class="shopping-card--hover" hover-stay-time="100" @click="openShoppingSheet">
                  <view class="shopping-card__main">
                    <text class="shopping-card__title">加入采购清单</text>
                    <text class="shopping-card__meta">可选现有活跃清单，也可现场新建一张清单。</text>
                  </view>
                  <text class="shopping-card__arrow">›</text>
                </view>
              </view>
            </template>
          </template>
        </view>
      </scroll-view>
    </view>

    <SheetShell
      :visible="consumeSheetVisible"
      title="扣减库存"
      subtitle="输入这次实际用掉的总量，系统会优先扣减更早到期的批次。"
      @close="consumeSheetVisible = false"
    >
      <view class="sheet-section">
        <text class="sheet-section__title">扣减数量</text>
        <view class="sheet-input-group">
          <input v-model="consumeQuantity" class="sheet-input sheet-input--grow" placeholder="输入用掉的数量" />
          <view class="sheet-input__suffix">{{ consumeUnitName || "选择单位" }}</view>
        </view>
        <picker v-if="consumeUnitOptions.length > 1" mode="selector" :range="consumeUnitNames" :value="consumeUnitIndex" @change="handleConsumeUnitChange">
          <view class="picker">选择单位：{{ consumeUnitName }}</view>
        </picker>
      </view>
      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" @click="consumeSheetVisible = false">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" @click="submitConsume">
            {{ consuming ? "扣减中..." : "确认扣减" }}
          </button>
        </view>
      </template>
    </SheetShell>

    <ShoppingTargetSheet
      :visible="shoppingSheetVisible"
      title="加入采购清单"
      subtitle="这次先只处理单食材补货，不改系统食材信息。"
      :create-mode="shoppingCreateMode"
      :creating="shoppingSubmitting"
      :create-disabled="shoppingCreateMode && !newListName.trim()"
      :create-name="newListName"
      :items="activeShoppingLists"
      :selected-id="selectedListId"
      :show-create-action="false"
      :show-create-option="true"
      :show-create-button="false"
      create-option-title="新建采购清单"
      create-option-text="没有合适的清单时，直接在这里新建。"
      hide-selected-state-when-creating
      @open-create="openCreateMode"
      @select="selectActiveList"
      @update:create-name="newListName = $event"
      @close="closeShoppingSheet"
      @after-close="resetShoppingSheet"
    >
      <view class="sheet-section">
        <text class="sheet-section__title">采购信息</text>
        <input v-model="shoppingQuantityText" class="sheet-input" placeholder="采购数量，可留空，例如 2 盒 / 500 克" />
        <input v-model="shoppingNote" class="sheet-input" placeholder="备注，可留空，例如 补周末做饭用量" />
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" @click="closeShoppingSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" @click="submitShopping">
            {{ shoppingSubmitting ? "加入中..." : "加入清单" }}
          </button>
        </view>
      </template>
    </ShoppingTargetSheet>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, onBeforeUnmount, ref } from "vue";
import type { UUID } from "@/apis/http";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import ImageLoader from "@/components/ImageLoader.vue";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import ShoppingTargetSheet from "../components/ShoppingTargetSheet.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useLoginEmptyState } from "@/composables/useLoginEmptyState";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { onSessionCleared } from "@/utils/session-events";
import { fridgeApi, type FridgeBatchSummary, type FridgeIngredientDetail } from "../apis/fridge";
import { shoppingApi, type ShoppingListSummary } from "../apis/shopping";
import { formatExpireLabel, resolveFridgeImageMap } from "../utils/fridge";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(handleLoginSuccess);

const NAV_FADE_DISTANCE = 96;

const itemId = ref<UUID | "">("");
const ingredientId = ref<UUID | "">("");
const loading = ref(false);
const consuming = ref(false);
const correcting = ref(false);
const errorText = ref("");
const scrollTop = ref(0);
const currentItem = ref<FridgeIngredientDetail | null>(null);
const itemImageUrl = ref("");
const showExpired = ref(false);
const showHistory = ref(false);
const historyLoading = ref(false);
const historyBatches = ref<FridgeBatchSummary[]>([]);
const historyPage = ref(0);
const historyHasNext = ref(false);
const consumeSheetVisible = ref(false);
const consumeQuantity = ref("");
const consumeUnitIndex = ref(0);
const shoppingSheetVisible = ref(false);
const shoppingSubmitting = ref(false);
const shoppingCreateMode = ref(false);
const activeShoppingLists = ref<ShoppingListSummary[]>([]);
const selectedListId = ref<UUID | "">("");
const newListName = ref("");
const shoppingQuantityText = ref("");
const shoppingNote = ref("");
let contextRequestId = 0;

function clearPrivateState() {
  contextRequestId += 1;
  loading.value = false;
  consuming.value = false;
  correcting.value = false;
  errorText.value = "";
  currentItem.value = null;
  itemImageUrl.value = "";
  ingredientId.value = "";
  itemId.value = "";
  showExpired.value = false;
  showHistory.value = false;
  historyLoading.value = false;
  historyBatches.value = [];
  historyPage.value = 0;
  historyHasNext.value = false;
  consumeSheetVisible.value = false;
  consumeQuantity.value = "";
  consumeUnitIndex.value = 0;
  shoppingSheetVisible.value = false;
  shoppingSubmitting.value = false;
  shoppingCreateMode.value = false;
  activeShoppingLists.value = [];
  selectedListId.value = "";
  newListName.value = "";
  shoppingQuantityText.value = "";
  shoppingNote.value = "";
}

const stopSessionCleanup = onSessionCleared(clearPrivateState);
onBeforeUnmount(stopSessionCleanup);

const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`
}));
const stockSummary = computed(() => {
  if (!currentItem.value) return "未找到库存";
  return currentItem.value.stockText || "未填数量";
});
const expireSummary = computed(() => {
  if (!currentItem.value) return "请返回上一页重试";
  if (currentItem.value.expiredBatchCount) return "有过期库存，请确认还能用再安排";
  return currentItem.value.expireAt ? `最近到期：${formatExpireLabel(currentItem.value.expireAt)}` : "到期时间未设置";
});
const consumeUnitOptions = computed(() => currentItem.value?.stockGroups ?? []);
const consumeUnitNames = computed(() => consumeUnitOptions.value.map(item => item.unitName));
const consumeUnitId = computed(() => consumeUnitOptions.value[consumeUnitIndex.value]?.unitId ?? null);
const consumeUnitName = computed(() => consumeUnitOptions.value[consumeUnitIndex.value]?.unitName ?? "");
const shoppingSubmitDisabled = computed(() => {
  if (shoppingSubmitting.value || !currentItem.value) return true;
  if (shoppingCreateMode.value) return !newListName.value.trim();
  return !selectedListId.value;
});

onLoad(options => {
  if (typeof options?.ingredientId === "string" && options.ingredientId) {
    const parsed = Number(options.ingredientId);
    ingredientId.value = Number.isInteger(parsed) && parsed > 0 ? parsed : "";
  }
  if (typeof options?.itemId === "string" && options.itemId) {
    const parsed = Number(options.itemId);
    itemId.value = Number.isInteger(parsed) && parsed > 0 ? parsed : "";
  }
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadContext();
});

async function handleLoginSuccess() {
  await loadContext();
}

async function loadContext() {
  if (!sessionStore.isLoggedIn || loading.value || (!ingredientId.value && !itemId.value)) return;
  const requestId = ++contextRequestId;
  loading.value = true;
  errorText.value = "";
  try {
    const nextItem = itemId.value && !ingredientId.value
      ? await fridgeApi.getBatchDetail(itemId.value)
      : await fridgeApi.getDetail(ingredientId.value as UUID);
    if (requestId !== contextRequestId || !sessionStore.isLoggedIn) return;
    currentItem.value = nextItem;
    const imageMap = await resolveFridgeImageMap([{ id: nextItem.id, ingredientId: nextItem.ingredientId, name: nextItem.name }], 1);
    if (requestId !== contextRequestId || !sessionStore.isLoggedIn) return;
    itemImageUrl.value = imageMap[String(nextItem.id)] || "";
  } catch (error) {
    if (requestId !== contextRequestId || !sessionStore.isLoggedIn) return;
    errorText.value = error instanceof Error ? error.message : "食材详情加载失败";
  } finally {
    if (requestId === contextRequestId) loading.value = false;
  }
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openRestock() {
  if (!currentItem.value) return;
  const query = currentItem.value.ingredientId
    ? `ingredientId=${encodeURIComponent(String(currentItem.value.ingredientId))}&name=${encodeURIComponent(currentItem.value.name)}`
    : `name=${encodeURIComponent(currentItem.value.name)}`;
  void uniPlatform.navigation.navigateTo(`/pages_pantry/item-edit/index?${query}`);
}

function openBatchEdit(batchId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_pantry/item-edit/index?itemId=${encodeURIComponent(String(batchId))}`);
}

async function markFridgeState(mode: "ROUGH" | "EMPTY") {
  if (!currentItem.value || correcting.value) return;
  const batches = [...currentItem.value.activeBatches, ...currentItem.value.expiredBatches];
  if (!batches.length) return;
  if (mode === "EMPTY") {
    const confirmed = await uniPlatform.feedback.confirm({
      title: "标记用完",
      content: `确认把${currentItem.value.name}的当前库存标记为已用完吗？`
    });
    if (!confirmed) return;
  }
  correcting.value = true;
  try {
    await fridgeApi.updateMany({
      operationId: createOperationId(),
      itemIds: batches.map(batch => batch.id),
      available: mode === "ROUGH",
      quantityText: mode === "ROUGH" ? "快用完" : "已用完",
      exactQuantity: null,
      exactUnitId: null
    });
    await uniPlatform.feedback.toast({ title: mode === "ROUGH" ? "已标记快用完" : "已标记用完", icon: "success" });
    await loadContext();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "库存更新失败", icon: "none" });
    await loadContext();
  } finally {
    correcting.value = false;
  }
}

function openConsumeSheet() {
  if (!currentItem.value?.ingredientId) {
    void uniPlatform.feedback.toast({ title: "请先确认食材身份", icon: "none" });
    return;
  }
  if (!consumeUnitOptions.value.length) {
    void uniPlatform.feedback.toast({ title: "请先补充精确数量和单位", icon: "none" });
    return;
  }
  consumeQuantity.value = "";
  consumeUnitIndex.value = 0;
  consumeSheetVisible.value = true;
}

function handleConsumeUnitChange(event: { detail: { value: string } }) {
  consumeUnitIndex.value = Number(event.detail.value) || 0;
}

async function submitConsume() {
  if (!currentItem.value?.ingredientId || !consumeUnitId.value || consuming.value) return;
  const quantity = consumeQuantity.value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
    await uniPlatform.feedback.toast({ title: "请输入大于 0 的数量", icon: "none" });
    return;
  }
  consuming.value = true;
  try {
    await fridgeApi.consume(currentItem.value.ingredientId, quantity, consumeUnitId.value, createOperationId());
    await uniPlatform.feedback.toast({ title: "已扣减", icon: "success" });
    consumeSheetVisible.value = false;
    await loadContext();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "扣减失败", icon: "none" });
  } finally {
    consuming.value = false;
  }
}

async function toggleHistory() {
  if (showHistory.value) {
    showHistory.value = false;
    return;
  }
  if (!currentItem.value?.ingredientId || historyLoading.value) return;
  showHistory.value = true;
  if (historyPage.value > 0) return;
  await loadHistoryPage(1, true);
}

async function loadHistoryPage(page: number, initial = false) {
  if (!currentItem.value?.ingredientId || historyLoading.value) return;
  historyLoading.value = true;
  try {
    const result = await fridgeApi.getHistory(currentItem.value.ingredientId, page, 100);
    historyBatches.value = page === 1 ? result.items : [...historyBatches.value, ...result.items];
    historyPage.value = page;
    historyHasNext.value = result.hasNext;
  } catch (error) {
    if (initial) showHistory.value = false;
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "历史批次加载失败", icon: "none" });
  } finally {
    historyLoading.value = false;
  }
}

async function loadMoreHistory() {
  if (!historyHasNext.value || historyLoading.value) return;
  await loadHistoryPage(historyPage.value + 1);
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
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "采购清单加载失败", icon: "none" });
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

function openCreateMode() {
  shoppingCreateMode.value = true;
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
      throw new Error("请选择采购清单");
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
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
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

.detail-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--page-ambient-duo-bg);
}

.detail-hero {
  position: relative;
  flex: 0 0 auto;
}

.detail-hero__cover {
  position: relative;
  overflow: hidden;
  padding-top: 100%;
  background: var(--color-surface);
}

.detail-hero__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
}

.detail-content-scroll {
  z-index: 1;
  flex: 1;
  height: 100%;
  min-height: 0;
  margin-top: -54rpx;
}

.detail-content {
  min-height: 100%;
  padding: 32rpx 0 max(48rpx, env(safe-area-inset-bottom));
  box-sizing: border-box;
  border-radius: 36rpx 36rpx 0 0;
  background: var(--color-surface);
}

.summary-card {
  position: absolute;
  right: var(--space-page);
  bottom: 54rpx;
  left: var(--space-page);
  z-index: 2;
}

.summary-card__eyebrow,
.summary-card__title,
.summary-card__stock,
.summary-card__description,
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

.summary-card__eyebrow {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  letter-spacing: 0.12em;
}

.summary-card__title {
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
}

.summary-card__stock {
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.summary-card__description {
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
  background: var(--color-tag-warning-bg);
  color: var(--color-tag-warning-text);
}

.badge--info {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.badge--muted {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}

.notice,
.section-card {
  border-radius: var(--radius-lg);
  background: var(--color-surface-soft-card);
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
  color: var(--color-support-action);
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

.batch-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.batch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: 22rpx 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.batch-row--expired {
  background: var(--color-tag-warning-bg);
}

.batch-row__main {
  flex: 1;
  min-width: 0;
}

.batch-row__side {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.batch-row__title,
.batch-row__meta,
.batch-row__value,
.collapse-header__arrow {
  display: block;
}

.history-more {
  display: flex;
  justify-content: center;
  padding: 18rpx 0 4rpx;
}

.history-more__text {
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.batch-row__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.batch-row__meta {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.batch-row__value,
.collapse-header__arrow {
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.batch-row__edit {
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
}

.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  margin: calc(-1 * var(--space-md));
  padding: var(--space-md);
}

.collapse-header__arrow {
  flex: 0 0 auto;
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

.action-grid--status {
  margin-top: var(--space-sm);
}

.action-button {
  min-height: 168rpx;
  padding: 24rpx 20rpx;
}

.action-button--accent {
  background: var(--color-state-warning-soft);
}

.action-button--status {
  min-height: 142rpx;
}

.action-button--danger {
  background: var(--color-tag-warning-bg);
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
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-input + .sheet-input {
  margin-top: 12rpx;
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
  height: 90rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}
</style>
