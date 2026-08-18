<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen navbar-transparent :navbar-placeholder="false">
    <template #navbar-center>
      <text class="home-nav__title" :style="navTitleStyle">食材</text>
    </template>

    <view v-if="sessionStore.isLoggedIn" class="home-nav-backdrop" :style="navBackdropStyle" />

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看食材"
      description="库存、到期和补货安排都归你本人所有。"
    />

    <view v-else class="pantry-home">
      <view class="top-dock" :style="topDockStyle">
        <view class="summary-strip summary-strip--dock">
          <view v-for="item in summaryItems" :key="item.label" class="summary-strip__item">
            <text class="summary-strip__value">{{ item.value }}</text>
            <text class="summary-strip__label">{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view class="pantry-home__scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          scroll-y
          class="pantry-home__scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          @scroll="handleScroll"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view class="pantry-home__body">
            <view class="pantry-hero" :style="heroStyle">
              <text class="pantry-hero__title">{{ heroTitle }}</text>
              <text class="pantry-hero__description">{{ heroDescription }}</text>
            </view>

            <view class="summary-strip">
              <view v-for="item in summaryItems" :key="item.label" class="summary-strip__item">
                <text class="summary-strip__value">{{ item.value }}</text>
                <text class="summary-strip__label">{{ item.label }}</text>
              </view>
            </view>

            <view class="quick-row">
              <view class="quick-card" hover-class="quick-card--hover" hover-stay-time="100" @click="openGap">
                <text class="quick-card__title">食材缺口</text>
                <text class="quick-card__value">{{ gapCount }}</text>
                <text class="quick-card__description">{{ gapDescription }}</text>
              </view>
              <view class="quick-card" hover-class="quick-card--hover" hover-stay-time="100" @click="openShoppingLists">
                <text class="quick-card__title">购物清单</text>
                <text class="quick-card__value">{{ pendingShoppingCount }}</text>
                <text class="quick-card__description">{{ shoppingDescription }}</text>
              </view>
            </view>

            <view class="search-row">
              <RecipeSearchBar
                v-model="keyword"
                placeholder="搜索现有食材"
                @clear="handleSearchClear"
              />
            </view>

            <view class="filter-row">
              <view
                v-for="item in filterItems"
                :key="item.key"
                class="filter-chip"
                :class="{ 'filter-chip--active': activeFilter === item.key }"
                @click="changeFilter(item.key)"
              >
                <text class="filter-chip__label">{{ item.label }}</text>
                <text class="filter-chip__count">{{ item.count }}</text>
              </view>
            </view>

            <view v-if="errorText" class="notice" @click="loadPage">
              <text class="notice__text">{{ errorText }}</text>
              <text class="notice__action">重新加载</text>
            </view>
            <view v-else-if="loading && !cards.length" class="notice">
              <text class="notice__text">正在整理现有库存...</text>
            </view>
            <Empty
              v-else-if="!filteredCards.length"
              class="pantry-empty"
              :art="emptyStateArt"
              :title="emptyTitle"
              :description="emptyDescription"
            />

            <view v-else class="item-list">
              <view v-for="card in filteredCards" :key="card.id" class="item-card" hover-class="item-card--hover" hover-stay-time="100" @click="handleCardClick(card)">
                <view class="item-card__media">
                  <image v-if="card.imageUrl" class="item-card__image" :src="card.imageUrl" mode="aspectFill" />
                  <view v-else class="item-card__placeholder">{{ card.avatarText }}</view>
                </view>
                <view class="item-card__main">
                  <view class="item-card__top">
                    <text class="item-card__name">{{ card.name }}</text>
                    <text class="expiry-badge" :class="{ 'expiry-badge--warning': card.expireSoon }">{{ card.expireLabel }}</text>
                  </view>
                  <view class="item-card__bottom">
                    <text class="item-card__meta">{{ card.stockText }} · {{ card.categoryText }}</text>
                    <view class="item-card__actions">
                      <view class="item-card__action item-card__action--restock" @click.stop="openRestockSheet(card)">
                        <view class="cookfont icon-add item-card__action-icon" />
                        <view>补货</view>
                      </view>
                      <view class="item-card__action item-card__action--shopping" @click.stop="openShoppingSheet(card)">
                        <view class="cookfont icon-shopping item-card__action-icon" />
                        <view>采购</view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <SheetShell
      :visible="restockSheetVisible"
      title="补充库存"
      subtitle="这次把库存数量和到期时间记清楚就好。"
      @close="closeRestockSheet"
      @after-close="resetRestockSheet"
    >
      <view v-if="restockTarget" class="sheet-meta">
        <text class="sheet-meta__title">{{ restockTarget.name }}</text>
        <text class="sheet-meta__text">当前库存 · {{ restockTarget.stockText }} · {{ restockTarget.categoryText }}</text>
      </view>

      <view class="sheet-section">
        <text class="sheet-section__title">补货</text>
        <view v-if="restockUseFixedUnit" class="sheet-input-group">
          <input v-model="restockExactQuantity" class="sheet-input sheet-input--grow" placeholder="输入补货数量" />
          <view class="sheet-input__suffix">{{ restockFixedUnitName }}</view>
        </view>
        <input
          v-else
          v-model="restockQuantityText"
          class="sheet-input"
          placeholder="输入补货数量，例如 2 包 / 500 克"
        />
      </view>

      <view class="sheet-section">
        <view class="sheet-calendar-head">
          <text class="sheet-section__title">到期时间</text>
          <text class="sheet-calendar-head__date">{{ restockExpireDateText }}</text>
        </view>
        <MealMonthCalendar
          :selected-date="restockExpireDate"
          :month-date="restockMonthDate"
          :marks="{}"
          :min-date="todayDate"
          @select="handleRestockExpireSelect"
          @month-change="handleRestockExpireMonthChange"
        />
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="restockSubmitting" @click="closeRestockSheet">取消</button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="restockSubmitDisabled" @click="submitRestock">
            {{ restockSubmitting ? "补货中..." : "补进库存" }}
          </button>
        </view>
      </template>
    </SheetShell>

    <SheetShell
      :visible="shoppingSheetVisible"
      title="加入购物清单"
      subtitle="先记进清单里，后面补买更顺手。"
      @close="closeShoppingSheet"
      @after-close="resetShoppingSheet"
    >
      <view v-if="shoppingTarget" class="sheet-meta sheet-meta--shopping">
        <text class="sheet-meta__title">{{ shoppingTarget.name }}</text>
        <text class="sheet-meta__text">当前库存 · {{ shoppingTarget.stockText }} · {{ shoppingTarget.categoryText }}</text>
      </view>

      <view class="sheet-section">
        <view class="sheet-section__head">
          <text class="sheet-section__title">目标清单</text>
          <text class="sheet-section__action" @click="toggleShoppingCreateMode">{{ shoppingCreateMode ? "取消创建" : "创建清单" }}</text>
        </view>
        <view v-if="shoppingCreateMode" class="sheet-create-row">
          <input
            v-model="newListName"
            class="sheet-input sheet-input--grow"
            maxlength="20"
            placeholder="输入新清单名"
          />
          <view
            class="sheet-create-button"
            :class="{ 'sheet-create-button--disabled': shoppingCreateDisabled }"
            @click="createShoppingList"
          >
            {{ shoppingCreatingList ? "创建中..." : "创建" }}
          </view>
        </view>
        <view v-if="activeLists.length" class="sheet-option-list">
          <view
            v-for="list in activeLists"
            :key="list.id"
            class="sheet-option"
            :class="{ 'sheet-option--active': selectedListId === list.id }"
            @click="selectActiveList(list.id)"
          >
            <view class="sheet-option__main">
              <text class="sheet-option__title">{{ list.name }}</text>
              <text class="sheet-option__meta">剩余 {{ Math.max(list.progressTotalCount - list.progressDoneCount, 0) }} 项待处理</text>
            </view>
          </view>
        </view>
        <text v-else class="sheet-empty-tip">还没有现成清单，先创建一个再加入。</text>
      </view>

      <view class="sheet-section">
        <text class="sheet-section__title">采购信息</text>
        <view v-if="shoppingUseFixedUnit" class="sheet-input-group">
          <input v-model="shoppingExactQuantity" class="sheet-input sheet-input--grow" placeholder="输入采购数量" />
          <view class="sheet-input__suffix">{{ shoppingFixedUnitName }}</view>
        </view>
        <input
          v-else
          v-model="shoppingQuantityText"
          class="sheet-input"
          placeholder="输入采购数量，例如 2 包 / 500 克"
        />
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
import { onShow } from "@dcloudio/uni-app";
import { computed, ref, type CSSProperties } from "vue";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import MealMonthCalendar from "@/components/MealMonthCalendar.vue";
import RecipeSearchBar from "@/components/Recipe/RecipeSearchBar.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatDateOnly, parseDateOnly } from "@/utils/date";
import { createOperationId } from "@/utils/operation-id";
import { fridgeApi, type FridgeItemSummary } from "../apis/fridge";
import { shoppingApi, type ShoppingGapResponse, type ShoppingListSummary } from "../apis/shopping";
import {
  buildIngredientAvatarText,
  formatExpireLabel,
  getExpireDiffDays,
  isExpiringSoon,
  resolveFridgeImageMap
} from "../utils/fridge";

type FilterKey = "ALL" | "EXPIRING" | "RESERVED" | "NEED_EXACT";

interface PantryCard {
  id: UUID;
  name: string;
  ingredientId: UUID | null;
  exactUnitId: UUID | null;
  exactUnitName: string | null;
  categoryText: string;
  stockText: string;
  expireAt: string | null;
  expireLabel: string;
  expireSoon: boolean;
  hasReservation: boolean;
  needExact: boolean;
  imageUrl: string;
  avatarText: string;
}

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const { navBarTotalHeight } = useSystemInfo();
const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新食材",
    canRelease: ["松手刷新食材", "更新库存状态"],
    success: "食材已刷新"
  }
});

const HERO_TOP_GAP = 18;
const NAV_FADE_DISTANCE = 112;
const TOP_DOCK_DISTANCE = 172;

const loading = ref(false);
const errorText = ref("");
const scrollTop = ref(0);
const keyword = ref("");
const activeFilter = ref<FilterKey>("ALL");
const fridgeItems = ref<FridgeItemSummary[]>([]);
const gapData = ref<ShoppingGapResponse | null>(null);
const activeLists = ref<ShoppingListSummary[]>([]);
const imageMap = ref<Record<string, string>>({});
const restockSheetVisible = ref(false);
const restockSubmitting = ref(false);
const restockTarget = ref<PantryCard | null>(null);
const restockQuantityText = ref("");
const restockExactQuantity = ref("");
const restockExpireDate = ref("");
const restockMonthDate = ref("");
const shoppingSheetVisible = ref(false);
const shoppingSubmitting = ref(false);
const shoppingCreatingList = ref(false);
const shoppingTarget = ref<PantryCard | null>(null);
const shoppingCreateMode = ref(false);
const selectedListId = ref<UUID | "">("");
const newListName = ref("");
const shoppingQuantityText = ref("");
const shoppingExactQuantity = ref("");

const cards = computed<PantryCard[]>(() =>
  [...fridgeItems.value]
    .map(item => ({
      id: item.id,
      name: item.name,
      ingredientId: item.ingredientId,
      exactUnitId: item.exactUnitId,
      exactUnitName: item.exactUnitName,
      categoryText: item.categoryName || "未分类",
      stockText: item.stockText || item.quantityText || "未填库存",
      expireAt: item.expireAt,
      expireLabel: formatExpireLabel(item.expireAt),
      expireSoon: isExpiringSoon(item.expireAt),
      hasReservation: item.reservations.length > 0,
      needExact: !item.exactQuantity || !item.exactUnitId,
      imageUrl: imageMap.value[String(item.id)] || "",
      avatarText: buildIngredientAvatarText(item.name)
    }))
    .sort((left, right) => {
      const rankDiff = resolveCardRank(left) - resolveCardRank(right);
      if (rankDiff !== 0) return rankDiff;
      const expireDiff = resolveExpireSort(left.expireAt) - resolveExpireSort(right.expireAt);
      if (expireDiff !== 0) return expireDiff;
      return right.id - left.id;
    })
);

const ingredientCount = computed(() => cards.value.length);
const expiringCount = computed(() => cards.value.filter(item => item.expireSoon).length);
const pendingShoppingCount = computed(() =>
  activeLists.value.reduce((sum, item) => sum + Math.max(item.progressTotalCount - item.progressDoneCount, 0), 0)
);
const gapCount = computed(() => gapData.value?.totalItemCount ?? 0);

const summaryItems = computed(() => [
  { label: "食材数", value: String(ingredientCount.value) },
  { label: "临期提醒", value: String(expiringCount.value) },
  { label: "待采购", value: String(pendingShoppingCount.value) }
]);

const heroTitle = computed(() => {
  if (!ingredientCount.value) return "先把现有食材理清";
  if (expiringCount.value > 0) return "先把临期食材安排好";
  if (gapCount.value > 0 || pendingShoppingCount.value > 0) return "缺什么、要不要补货，一眼清楚";
  return "现有食材，一眼清楚";
});

const heroDescription = computed(() => {
  if (!ingredientCount.value) return "补进第一批库存后，后面盘点和采购都会更顺手。";
  if (expiringCount.value > 0) return `${expiringCount.value} 样食材快到期，先安排更省心。`;
  if (pendingShoppingCount.value > 0) return `${pendingShoppingCount.value} 项待采购，库存和补货安排都在这里。`;
  return "库存、到期和补货安排，都集中在这里。";
});

const gapDescription = computed(() => {
  if (!gapCount.value) return "当前没有明显缺口";
  return `${gapCount.value} 样还没备齐`;
});

const shoppingDescription = computed(() => {
  if (!pendingShoppingCount.value) return activeLists.value.length ? "待买项已经处理完" : "还没有待处理清单";
  return `${pendingShoppingCount.value} 项还待采购`;
});

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
const topDockStyle = computed<CSSProperties>(() => ({
  top: `${navBarTotalHeight.value}px`,
  opacity: `${scrollTop.value > TOP_DOCK_DISTANCE ? 1 : 0}`,
  pointerEvents: scrollTop.value > TOP_DOCK_DISTANCE ? "auto" : "none"
}));

const filterItems = computed(() => [
  { key: "ALL" as FilterKey, label: "全部", count: ingredientCount.value },
  { key: "EXPIRING" as FilterKey, label: "临期", count: cards.value.filter(item => item.expireSoon).length },
  { key: "RESERVED" as FilterKey, label: "预占中", count: cards.value.filter(item => item.hasReservation).length },
  { key: "NEED_EXACT" as FilterKey, label: "待补精确", count: cards.value.filter(item => item.needExact).length }
]);

const filteredCards = computed(() => {
  const searchKey = keyword.value.trim().toLowerCase();
  return cards.value.filter(item => {
    const matchFilter =
      activeFilter.value === "ALL" ||
      (activeFilter.value === "EXPIRING" && item.expireSoon) ||
      (activeFilter.value === "RESERVED" && item.hasReservation) ||
      (activeFilter.value === "NEED_EXACT" && item.needExact);
    if (!matchFilter) return false;
    if (!searchKey) return true;
    return item.name.toLowerCase().includes(searchKey) || item.categoryText.toLowerCase().includes(searchKey);
  });
});

const emptyTitle = computed(() => {
  if (!ingredientCount.value) return "还没有库存食材";
  if (keyword.value.trim()) return "没找到对应食材";
  return "当前筛选下没有食材";
});

const emptyDescription = computed(() => {
  if (!ingredientCount.value) return "先补进一些库存，后面缺口、采购和到期安排都会更清楚。";
  if (keyword.value.trim()) return "换个名字搜搜看，或者清空搜索后继续浏览。";
  return "换个状态看看，或者先去补货。";
});

const todayDate = formatDateOnly(new Date());
const restockUseFixedUnit = computed(() => Boolean(restockTarget.value?.exactUnitId && restockTarget.value?.exactUnitName));
const restockFixedUnitId = computed(() => restockTarget.value?.exactUnitId || null);
const restockFixedUnitName = computed(() => restockTarget.value?.exactUnitName || "");
const restockExpireDateText = computed(() => {
  if (!restockExpireDate.value) return "还没选到期日";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(restockExpireDate.value)) return restockExpireDate.value;
  const [, month, day] = restockExpireDate.value.split("-");
  return `${Number(month)}月${Number(day)}日`;
});
const restockSubmitDisabled = computed(() => {
  if (restockSubmitting.value || !restockTarget.value) return true;
  return restockUseFixedUnit.value ? !restockExactQuantity.value.trim() : !restockQuantityText.value.trim();
});

const shoppingUseFixedUnit = computed(() => Boolean(shoppingTarget.value?.exactUnitName));
const shoppingFixedUnitName = computed(() => shoppingTarget.value?.exactUnitName || "");
const shoppingCreateDisabled = computed(() => shoppingCreatingList.value || !newListName.value.trim());
const shoppingSubmitDisabled = computed(() => {
  if (shoppingSubmitting.value || shoppingCreatingList.value || !shoppingTarget.value) return true;
  if (shoppingUseFixedUnit.value && !shoppingExactQuantity.value.trim()) return true;
  return !selectedListId.value;
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
});

function resolveCardRank(item: Pick<PantryCard, "expireSoon" | "hasReservation" | "needExact">) {
  if (item.expireSoon) return 0;
  if (item.hasReservation) return 1;
  if (item.needExact) return 2;
  return 3;
}

function resolveExpireSort(value: string | null) {
  const diff = getExpireDiffDays(value);
  return diff === null ? Number.MAX_SAFE_INTEGER : diff;
}

async function loadPage() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const [fridgeResult, gapResult, listResult] = await Promise.all([
      fridgeApi.list(1, 100),
      shoppingApi.previewGap(),
      shoppingApi.listLists("ACTIVE")
    ]);
    fridgeItems.value = fridgeResult.items;
    gapData.value = gapResult;
    activeLists.value = listResult.items;
    imageMap.value = await resolveFridgeImageMap(fridgeResult.items, 18);
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "食材首页加载失败";
  } finally {
    loading.value = false;
  }
}

async function handleRefresherRefresh() {
  if (!onRefresherRefresh()) return;
  try {
    await loadPage();
  } finally {
    await onRefreshComplete();
  }
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function handleSearchClear() {
  keyword.value = "";
}

function changeFilter(nextFilter: FilterKey) {
  activeFilter.value = nextFilter;
}

function openGap() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/gap/index");
}

function openShoppingLists() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function handleCardClick(card: PantryCard) {
  void uniPlatform.navigation.navigateTo(`/pages_pantry/item-detail/index?itemId=${encodeURIComponent(String(card.id))}`);
}

async function openRestockSheet(card: PantryCard) {
  restockTarget.value = card;
  restockQuantityText.value = "";
  restockExactQuantity.value = "";
  restockExpireDate.value = "";
  restockMonthDate.value = buildMonthAnchor(todayDate);
  restockSheetVisible.value = true;
}

function closeRestockSheet() {
  restockSheetVisible.value = false;
}

function resetRestockSheet() {
  restockSubmitting.value = false;
  restockTarget.value = null;
  restockQuantityText.value = "";
  restockExactQuantity.value = "";
  restockExpireDate.value = "";
  restockMonthDate.value = buildMonthAnchor(todayDate);
}

function buildMonthAnchor(dateText: string) {
  const date = parseDateOnly(dateText);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-01`;
}

function handleRestockExpireSelect(dateText: string) {
  restockExpireDate.value = dateText;
  restockMonthDate.value = buildMonthAnchor(dateText);
}

function handleRestockExpireMonthChange(monthDate: string) {
  restockMonthDate.value = monthDate;
}

async function submitRestock() {
  if (!restockTarget.value || restockSubmitDisabled.value) return;
  const trimmedExactQuantity = restockExactQuantity.value.trim();
  if (restockUseFixedUnit.value && (!trimmedExactQuantity || !restockFixedUnitId.value)) {
    await uniPlatform.feedback.toast({ title: "请先输入补货数量", icon: "none" });
    return;
  }
  restockSubmitting.value = true;
  try {
    const quantityText = restockUseFixedUnit.value
      ? `${trimmedExactQuantity} ${restockFixedUnitName.value}`
      : restockQuantityText.value.trim() || null;
    await fridgeApi.create({
      operationId: createOperationId(),
      name: restockTarget.value.name,
      ingredientId: restockTarget.value.ingredientId,
      quantityText,
      exactQuantity: restockUseFixedUnit.value ? trimmedExactQuantity || null : null,
      exactUnitId: restockUseFixedUnit.value ? restockFixedUnitId.value : null,
      expireAt: restockExpireDate.value || null
    });
    await uniPlatform.feedback.toast({ title: "已补进库存", icon: "success" });
    closeRestockSheet();
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "补货失败", icon: "none" });
  } finally {
    restockSubmitting.value = false;
  }
}

async function openShoppingSheet(card: PantryCard) {
  shoppingTarget.value = card;
  shoppingCreateMode.value = !activeLists.value.length;
  selectedListId.value = activeLists.value[0]?.id || "";
  newListName.value = "";
  shoppingQuantityText.value = "";
  shoppingExactQuantity.value = "";
  shoppingSheetVisible.value = true;
}

function closeShoppingSheet() {
  shoppingSheetVisible.value = false;
}

function resetShoppingSheet() {
  shoppingSubmitting.value = false;
  shoppingCreatingList.value = false;
  shoppingTarget.value = null;
  shoppingCreateMode.value = false;
  selectedListId.value = activeLists.value[0]?.id || "";
  newListName.value = "";
  shoppingQuantityText.value = "";
  shoppingExactQuantity.value = "";
}

function selectActiveList(listId: UUID) {
  shoppingCreateMode.value = false;
  selectedListId.value = listId;
}

function toggleShoppingCreateMode() {
  shoppingCreateMode.value = !shoppingCreateMode.value;
  if (!shoppingCreateMode.value) {
    newListName.value = "";
    shoppingCreatingList.value = false;
  }
}

async function createShoppingList() {
  if (shoppingCreateDisabled.value) return;
  shoppingCreatingList.value = true;
  try {
    const createdList = await shoppingApi.createList({
      operationId: createOperationId(),
      name: newListName.value.trim()
    });
    activeLists.value = [createdList, ...activeLists.value.filter(item => item.id !== createdList.id)];
    selectedListId.value = createdList.id;
    shoppingCreateMode.value = false;
    newListName.value = "";
    await uniPlatform.feedback.toast({ title: "已创建清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建清单失败", icon: "none" });
  } finally {
    shoppingCreatingList.value = false;
  }
}

async function submitShopping() {
  if (!shoppingTarget.value || shoppingSubmitDisabled.value) return;
  shoppingSubmitting.value = true;
  try {
    if (!selectedListId.value) {
      throw new Error("请选择购物清单");
    }
    const quantityText = shoppingUseFixedUnit.value
      ? `${shoppingExactQuantity.value.trim()} ${shoppingFixedUnitName.value}`
      : shoppingQuantityText.value.trim() || null;
    await shoppingApi.createListItem(selectedListId.value, {
      operationId: createOperationId(),
      name: shoppingTarget.value.name,
      ingredientId: shoppingTarget.value.ingredientId,
      quantityText,
      note: null
    });
    await uniPlatform.feedback.toast({ title: "已加入清单", icon: "success" });
    closeShoppingSheet();
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.home-nav-backdrop {
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

.home-nav__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  transition: opacity 180ms ease;
}

.pantry-home {
  position: relative;
  height: 100%;
}

.pantry-home__scroll-wrap {
  position: relative;
  height: 100%;
}

.pantry-home__scroll {
  height: 100%;
}

.pantry-home__body {
  min-height: 100%;
  padding-bottom: calc(200rpx + env(safe-area-inset-bottom));
}

.top-dock {
  position: fixed;
  right: var(--space-page);
  left: var(--space-page);
  z-index: 780;
  transition: opacity 180ms ease;
}

.pantry-hero {
  --pantry-hero-end: var(--color-page);

  position: relative;
  min-height: 418rpx;
  padding: 56rpx var(--space-page) 138rpx;
  border-bottom-right-radius: 56rpx;
  border-bottom-left-radius: 56rpx;
  background:
    radial-gradient(circle at 14% 72%, var(--color-primary-soft) 0, transparent 34%),
    radial-gradient(circle at 86% 18%, color-mix(in srgb, var(--color-primary-soft) 72%, var(--color-surface) 28%) 0, transparent 30%),
    linear-gradient(155deg,
      color-mix(in srgb, var(--color-surface) 84%, var(--color-page) 16%),
      color-mix(in srgb, var(--color-page) 84%, var(--color-primary-soft) 16%));
  overflow: hidden;
}

.pantry-hero::before,
.pantry-hero::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.pantry-hero::before {
  top: 92rpx;
  right: -76rpx;
  z-index: 1;
  width: 312rpx;
  height: 224rpx;
  border-radius: 50%;
  background: var(--color-surface-mask-weak);
  transform: rotate(-16deg);
}

.pantry-hero::after {
  --pantry-mask-solid: #000;
  --pantry-mask-strong: rgba(0, 0, 0, 0.76);
  --pantry-mask-mid: rgba(0, 0, 0, 0.42);

  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 240rpx;
  background: var(--pantry-hero-end);
  mask-image:
    radial-gradient(ellipse at 14% 100%,
      var(--pantry-mask-solid) 0%,
      var(--pantry-mask-strong) 36%,
      transparent 72%),
    radial-gradient(ellipse at 86% 100%,
      var(--pantry-mask-solid) 0%,
      var(--pantry-mask-strong) 36%,
      transparent 72%),
    linear-gradient(to bottom,
      transparent 0%,
      var(--pantry-mask-mid) 48%,
      var(--pantry-mask-solid) 100%);
  mask-size: 100% 100%;
  -webkit-mask-image:
    radial-gradient(ellipse at 14% 100%,
      var(--pantry-mask-solid) 0%,
      var(--pantry-mask-strong) 36%,
      transparent 72%),
    radial-gradient(ellipse at 86% 100%,
      var(--pantry-mask-solid) 0%,
      var(--pantry-mask-strong) 36%,
      transparent 72%),
    linear-gradient(to bottom,
      transparent 0%,
      var(--pantry-mask-mid) 48%,
      var(--pantry-mask-solid) 100%);
  -webkit-mask-size: 100% 100%;
}

.pantry-hero__title,
.pantry-hero__description,
.summary-strip__value,
.summary-strip__label,
.quick-card__title,
.quick-card__value,
.quick-card__description,
.filter-chip__label,
.filter-chip__count,
.notice__text,
.notice__action,
.item-card__placeholder,
.item-card__name,
.item-card__meta,
.expiry-badge,
.sheet-meta__title,
.sheet-meta__text,
.sheet-card__title,
.sheet-card__meta,
.sheet-section__title,
.sheet-option__title,
.sheet-option__meta {
  display: block;
}

.pantry-hero__title,
.pantry-hero__description {
  position: relative;
  z-index: 2;
}

.pantry-hero__title {
  color: var(--color-text);
  font-size: 58rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.16;
}

.pantry-hero__description {
  margin-top: 16rpx;
  max-width: 620rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.65;
}

.summary-strip,
.quick-card,
.notice,
.item-card,
.sheet-card,
.sheet-option,
.sheet-input,
.sheet-picker {
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0 var(--space-page);
  padding: 22rpx 12rpx;
}

.pantry-home__body > .summary-strip {
  position: relative;
  z-index: 3;
  margin-top: -54rpx;
}

.summary-strip--dock {
  margin: 0;
}

.summary-strip__item {
  position: relative;
  padding: 10rpx 12rpx;
  text-align: center;
}

.summary-strip__item + .summary-strip__item::before {
  content: "";
  position: absolute;
  top: 18rpx;
  bottom: 18rpx;
  left: 0;
  width: 1rpx;
  background: var(--color-divider);
}

.summary-strip__value {
  color: var(--color-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.1;
}

.summary-strip__label {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.quick-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  margin: 18rpx var(--space-page) 0;
}

.quick-card {
  padding: 28rpx 26rpx;
}

.quick-card--hover,
.item-card--hover {
  opacity: 0.92;
}

.quick-card__title {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.quick-card__value {
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.1;
}

.quick-card__description {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.search-row,
.filter-row,
.notice,
.pantry-empty,
.item-list {
  margin-right: var(--space-page);
  margin-left: var(--space-page);
}

.search-row {
  margin-top: 18rpx;
}

.filter-row {
  display: flex;
  gap: 12rpx;
  margin-top: 18rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.filter-row::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 22rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  box-shadow: 0 8rpx 24rpx var(--color-surface-mask-weak);
}

.filter-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.filter-chip__label {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.filter-chip__count {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.filter-chip--active .filter-chip__count {
  color: var(--color-primary);
}

.notice,
.pantry-empty,
.item-list {
  margin-top: 18rpx;
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

.item-card + .item-card {
  margin-top: 16rpx;
}

.item-card {
  padding: 20rpx 24rpx;
  display: flex;
  align-items: stretch;
  gap: 20rpx;
  overflow: hidden;
}

.item-card__media {
  flex: 0 0 128rpx;
}

.item-card__image,
.item-card__placeholder {
  width: 128rpx;
  height: 128rpx;
  border-radius: var(--radius-sm);
}

.item-card__image {
  display: block;
  background: var(--color-surface-muted);
}

.item-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 24% 24%, var(--color-primary-soft), transparent 46%),
    linear-gradient(180deg, var(--color-surface), var(--color-surface-muted));
  color: var(--color-primary);
  font-size: 44rpx;
  font-weight: var(--font-weight-heavy);
}

.item-card__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  min-height: 128rpx;
}

.item-card__top,
.item-card__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-width: 0;
}

.item-card__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  line-height: 1.28;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-card__meta {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expiry-badge {
  flex: 0 0 auto;
  max-width: 200rpx;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.3;
  text-align: right;
}

.expiry-badge--warning {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.item-card__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 12rpx;
}

.item-card__action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 40rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-xs);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.item-card__action-icon {
  font-size: 22rpx;
  color: inherit;
}

.item-card__action--restock {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.item-card__action--shopping {
  background: var(--color-warning-soft);
  color: var(--color-warning-text);
}

.sheet-meta__title {
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.16;
}

.sheet-meta {
  margin-top: 16rpx;
}

.sheet-meta--shopping {
  margin-top: 24rpx;
}

.sheet-meta__text {
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.sheet-card {
  padding: 22rpx 24rpx;
}

.sheet-card__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.sheet-card__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.sheet-section {
  margin-top: 24rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin-bottom: 14rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.sheet-section__head .sheet-section__title {
  margin-bottom: 0;
}

.sheet-calendar-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 14rpx;
}

.sheet-calendar-head__date {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__action {
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.sheet-option-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.sheet-create-row {
  display: flex;
  align-items: stretch;
  gap: 14rpx;
  margin-bottom: 14rpx;
}

.sheet-create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 144rpx;
  min-height: 88rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-xs);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  box-sizing: border-box;
}

.sheet-create-button--disabled {
  opacity: 0.4;
}

.sheet-option {
  padding: 22rpx 24rpx;
  border: 1rpx solid var(--color-border);
}

.sheet-option + .sheet-option,
.sheet-option + .sheet-input,
.sheet-input + .sheet-input,
.sheet-picker + .sheet-input,
.sheet-input + .sheet-picker {
  margin-top: 14rpx;
}

.sheet-option--active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.sheet-option__title {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.sheet-option__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.sheet-empty-tip {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.sheet-input,
.sheet-picker {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 0 24rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
}

.sheet-input-group {
  display: flex;
  align-items: center;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.sheet-input--grow {
  flex: 1;
  min-width: 0;
}

.sheet-input__suffix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 108rpx;
  min-height: 88rpx;
  padding: 0 24rpx;
  border-left: 1rpx solid var(--color-divider);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  box-sizing: border-box;
}

.sheet-picker--disabled {
  color: var(--color-text-tertiary);
}

.sheet-actions__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.sheet-actions {
  display: flex;
  gap: 18rpx;
}

.sheet-actions__button {
  flex: 1;
  min-height: 86rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button--cancel {
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}
</style>
