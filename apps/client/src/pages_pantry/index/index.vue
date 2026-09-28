<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="食材参考" :class="themeClasses">
    <Empty
      v-if="!sessionStore.isLoggedIn"
      :art="emptyStateArt"
      title="登录后查看食材参考"
      description="这里会显示最近买过或用过的食材痕迹，不需要维护精确库存。"
      clickable
      @click="openLogin"
    />

    <view v-else class="trace-page">
      <view class="trace-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />
        <scroll-view
          class="trace-scroll"
          scroll-y
          :scroll-top="traceScrollTop"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          @scrolltolower="handleScrollToLower"
          @scroll="handleTraceScroll"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view class="trace-content">
            <text class="trace-intro">最近买过、用过的食材会记在这里，家里有变化时也可以随手更新。</text>

            <view v-if="ingredientCategories.length" class="trace-manage">
              <view class="trace-category-fixed">
                <view
                  class="trace-category-chip"
                  :class="{ 'trace-category-chip--active': categoryFilter === null }"
                  @click="changeCategory(null)"
                >全部</view>
              </view>
              <scroll-view scroll-x class="trace-category-scroll" :show-scrollbar="false">
                <view class="trace-category-row">
                  <view
                    v-for="category in ingredientCategories"
                    :key="category.id"
                    class="trace-category-chip"
                    :class="{ 'trace-category-chip--active': categoryFilter === category.id }"
                    @click="changeCategory(category.id)"
                  >{{ category.name }}</view>
              </view>
            </scroll-view>
            <view v-if="hasTraceItems" class="trace-manage__actions">
              <text v-if="!manageMode" class="trace-manage__action" @click="enterManageMode">管理</text>
              <template v-else>
                <text class="trace-manage__action" @click="toggleSelectAll">{{ selectingAll ? "加载中..." : allVisibleSelected ? "取消全选" : "全选" }}</text>
                <text class="trace-manage__action" @click="exitManageMode">取消</text>
              </template>
            </view>
          </view>

          <view v-if="loading && !traces.length" class="trace-state">加载中...</view>
            <view v-else-if="errorText" class="trace-state trace-state--error" @click="loadPage()">{{ errorText }}，点此重试</view>
          <Empty
            v-else-if="!filteredCurrentTraces.length && !filteredArchivedTraces.length && !hasNext"
            class="trace-empty"
            :art="emptyStateArt"
            :title="activeCategoryName ? `${activeCategoryName}里还没有食材` : '还没有记录的食材'"
            :description="activeCategoryName ? '换个分类看看，或添加食材。' : '可以手动添加，或在购物清单里勾选已买后自动记录。'"
          />
          <template v-else>
            <view v-if="filteredCurrentTraces.length" class="trace-list">
              <view
                v-for="trace in filteredCurrentTraces"
                :key="trace.id"
                class="trace-card"
                :class="{ 'trace-card--manage': manageMode }"
                @click="manageMode ? toggleTraceSelected(trace) : undefined"
              >
                <view
                  v-if="manageMode"
                  class="trace-card__select"
                  :class="{ 'trace-card__select--checked': selectedTraceIds.has(trace.id) }"
                  role="checkbox"
                  :aria-label="trace.name"
                  :aria-checked="selectedTraceIds.has(trace.id)"
                  @click.stop="toggleTraceSelected(trace)"
                >
                  <text v-if="selectedTraceIds.has(trace.id)" class="trace-card__check-icon">✓</text>
                </view>
                <view class="trace-card__body">
                  <view class="trace-card__main">
                    <text class="trace-card__name">{{ trace.name }}</text>
                    <text class="trace-card__category">{{ trace.categoryName || "未分类" }}</text>
                  </view>
                  <text class="trace-card__label">{{ trace.label }} · {{ formatRecordedAt(trace.recordedAt) }}</text>
                </view>
              </view>
            </view>

            <view v-if="filteredArchivedTraces.length" class="archive-section">
              <button class="archive-toggle" @click="archiveExpanded = !archiveExpanded">
                <text>很久没记录</text>
                <text>{{ archiveExpanded ? "收起" : "展开" }}</text>
              </button>
              <view v-if="archiveExpanded" class="trace-list">
                <view
                  v-for="trace in filteredArchivedTraces"
                  :key="trace.id"
                  class="trace-card trace-card--archived"
                  :class="{ 'trace-card--manage': manageMode }"
                  @click="manageMode ? toggleTraceSelected(trace) : undefined"
                >
                  <view
                    v-if="manageMode"
                    class="trace-card__select"
                    :class="{ 'trace-card__select--checked': selectedTraceIds.has(trace.id) }"
                    role="checkbox"
                    :aria-label="trace.name"
                    :aria-checked="selectedTraceIds.has(trace.id)"
                    @click.stop="toggleTraceSelected(trace)"
                  >
                    <text v-if="selectedTraceIds.has(trace.id)" class="trace-card__check-icon">✓</text>
                  </view>
                  <view class="trace-card__body">
                    <view class="trace-card__main">
                      <text class="trace-card__name">{{ trace.name }}</text>
                      <text class="trace-card__category">{{ trace.categoryName || "未分类" }}</text>
                    </view>
                    <text class="trace-card__label">{{ formatRecordedAt(trace.recordedAt) }} · 超过 30 天未更新</text>
                  </view>
                </view>
              </view>
            </view>
              <Empty
                v-if="!filteredCurrentTraces.length && !filteredArchivedTraces.length && hasNext"
                class="trace-empty"
                :art="emptyStateArt"
                :title="activeCategoryName ? `${activeCategoryName}里还没有食材` : '还没有记录的食材'"
                :description="activeCategoryName ? '换个分类看看，或添加食材。' : '可以手动添加，或在购物清单里勾选已买后自动记录。'"
              />
              <view v-if="moreErrorText" class="trace-state trace-state--error" @click="loadMoreTraces()">{{ moreErrorText }}，点此重试</view>
            <LoadMore
              :loading="loadingMore || selectingAll"
              :has-next="hasNext"
              :show-done="loadedMoreOnce && !hasNext"
              next-text="继续上滑，查看更多食材"
              done-text="已经翻到底啦"
            />
          </template>
          </view>
        </scroll-view>
      </view>

      <view class="trace-actions">
        <template v-if="!manageMode">
          <MealFooterActions
            class="trace-actions__footer"
            :quick-action="{ label: '购物清单', iconClass: 'icon-shopping' }"
            :primary-action="{ label: '添加食材' }"
            single-button
            @quick="openShopping"
            @primary="openAddSheet"
          />
        </template>
        <button
          v-else
          class="trace-actions__mark-empty"
          :class="{ 'trace-actions__mark-empty--disabled': !selectedTraceIds.size || updatingTraces }"
          :disabled="!selectedTraceIds.size || updatingTraces"
          @click="confirmMarkSelectedEmpty"
        >
          {{ updatingTraces ? "处理中..." : "家里没有了" }}
        </button>
      </view>
    </view>

    <SheetShell
      :visible="addSheetVisible"
      title="添加食材"
      subtitle="看看家里现在有哪些食材，选好就记下来。"
      body-padding="none"
      @close="closeAddSheet"
      @after-close="handleAddSheetAfterClose"
    >
      <IngredientPickerContent
        hint-text="选中的食材会记在这里，安排下一顿更方便。"
        v-model:keyword="ingredientKeyword"
        :search-mode="ingredientSearchMode"
        :search-loading="ingredientSearchLoading"
        :search-items="ingredientSearchItems"
        :loading="ingredientLoading"
        :category-items="ingredientOptions"
        :categories="ingredientCategories"
        :category-id="ingredientCategoryId"
        :all-active="ingredientAllActive"
        :source-filter="ingredientSourceFilter"
        :show-personal-actions="false"
        :selected-ids="selectedIngredientIds"
        :selected-items="selectedIngredients"
        :existing-ids="existingIngredientIds"
        :footer-text="ingredientFooterText"
        :error-text="ingredientErrorText"
        empty-text="没有符合条件的食材。"
        :show-empty-create="false"
        :show-search-create="false"
        :confirm-disabled="!selectedIngredients.length || submitting"
        confirm-text="记下来"
        :picker-height="ingredientSearchMode ? undefined : '320px'"
        @search="searchIngredients"
        @clear-search="exitIngredientSearch"
        @clear-category="clearIngredientCategory"
        @change-source="changeIngredientSourceFilter"
        @change-category="changeIngredientCategory"
        @load-more="loadMoreIngredients"
        @toggle="selectIngredient"
        @remove="removeSelectedIngredient"
        @confirm="addSelectedIngredients"
      />
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import IngredientPickerContent from "@/components/Ingredient/IngredientPickerContent.vue";
import Layout from "@/components/Layout/Layout.vue";
import MealFooterActions from "@/components/Meal/MealFooterActions.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { recipeApi, type IngredientCategorySummary, type IngredientSummary } from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import LoadMore from "@/components/LoadMore.vue";
import { useLoginEmptyState } from "../composables/useLoginEmptyState";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { fridgeApi, type FridgeTraceSummary } from "../apis/fridge";

type TracePageCache = {
  items: FridgeTraceSummary[];
  page: number;
  hasNext: boolean;
  loadedMoreOnce: boolean;
};

const { themeVars, themeClasses } = useTheme();
const pageStyle = usePageScrollStyle();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(handleLoginSuccess);
const traces = ref<FridgeTraceSummary[]>([]);
const traceCache = new Map<string, TracePageCache>();
let traceCacheUserId: number | null = null;
const currentTraces = computed(() => traces.value.filter(trace => !trace.archived && trace.presence !== "EMPTY"));
const archivedTraces = computed(() => traces.value.filter(trace => trace.archived));
const categoryFilter = ref<UUID | null>(null);
const hasTraceItems = computed(() => currentTraces.value.length > 0 || archivedTraces.value.length > 0);
const filteredCurrentTraces = computed(() => currentTraces.value);
const filteredArchivedTraces = computed(() => archivedTraces.value);
const activeCategoryName = computed(() => ingredientCategories.value.find(item => item.id === categoryFilter.value)?.name || "");
const loading = ref(false);
const traceScrollTop = ref(0);
const loadingMore = ref(false);
const loadedMoreOnce = ref(false);
const hasNext = ref(false);
const tracePage = ref(1);
const errorText = ref("");
const moreErrorText = ref("");
const traceRequestSeed = ref(0);
const selectingAll = ref(false);
const archiveExpanded = ref(false);
const manageMode = ref(false);
const selectedTraceIds = ref(new Set<FridgeTraceSummary["id"]>());
const updatingTraces = ref(false);
const selectableTraces = computed(() => archiveExpanded.value
  ? [...filteredCurrentTraces.value, ...filteredArchivedTraces.value]
  : filteredCurrentTraces.value);
const allVisibleSelected = computed(() => selectableTraces.value.length > 0
  && !hasNext.value
  && selectableTraces.value.every(trace => selectedTraceIds.value.has(trace.id)));
const addSheetVisible = ref(false);
const ingredientKeyword = ref("");
const ingredientLoading = ref(false);
const ingredientErrorText = ref("");
const ingredientOptions = ref<IngredientSummary[]>([]);
const ingredientCategories = ref<IngredientCategorySummary[]>([]);
const ingredientCategoryId = ref<UUID | "">("");
const ingredientSourceFilter = ref<"ALL" | "PERSONAL">("ALL");
const ingredientPage = ref(1);
const ingredientHasNext = ref(false);
const ingredientLoadingMore = ref(false);
const ingredientRequestSeed = ref(0);
const ingredientLoadedKeyword = ref("");
const ingredientSearchPending = ref(false);
let ingredientSearchTimer: ReturnType<typeof setTimeout> | null = null;
const selectedIngredients = ref<IngredientSummary[]>([]);
const submitting = ref(false);
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
    canRelease: ["松手刷新食材", "更新食材状态"],
    success: "食材已刷新"
  }
});
const ingredientSearchMode = computed(() => Boolean(ingredientKeyword.value.trim()));
const ingredientSearchLoading = computed(() => ingredientSearchMode.value && (ingredientSearchPending.value || ingredientLoading.value));
const ingredientSearchItems = computed(() => ingredientLoadedKeyword.value === ingredientKeyword.value.trim() ? ingredientOptions.value : []);
const ingredientAllActive = computed(() => ingredientSourceFilter.value === "ALL" && !ingredientCategoryId.value);
const selectedIngredientIds = computed(() => selectedIngredients.value.map(item => item.id));
const existingIngredientIds = computed(() => [...new Set(currentTraces.value.flatMap(trace => trace.ingredientId ? [trace.ingredientId] : []))]);
const ingredientFooterText = computed(() => {
  if (ingredientLoadingMore.value) return "加载中...";
  return ingredientHasNext.value ? "上滑加载更多" : "";
});

watch(ingredientKeyword, () => {
  if (!addSheetVisible.value) return;
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchPending.value = Boolean(ingredientKeyword.value.trim());
  ingredientSearchTimer = setTimeout(() => {
    ingredientSearchTimer = null;
    void loadIngredientOptions(true);
  }, 280);
});

onShow(() => {
  if (!sessionStore.isLoggedIn) {
    clearTraceCache();
    traceCacheUserId = null;
    return;
  }
  prepareTraceCacheForUser();
  const cached = traceCache.get(traceCacheKey());
  if (cached) applyTraceCache(cached);
  else void loadPage();
});

async function handleLoginSuccess() {
  prepareTraceCacheForUser();
  await loadPage({ reset: true });
}

function traceCacheKey(categoryId = categoryFilter.value) {
  return `${sessionStore.uid}:${categoryId === null ? "all" : categoryId}`;
}

function applyTraceCache(cache: TracePageCache) {
  traces.value = cache.items;
  tracePage.value = cache.page;
  hasNext.value = cache.hasNext;
  loadedMoreOnce.value = cache.loadedMoreOnce;
  moreErrorText.value = "";
}

function clearTraceCache() {
  traceCache.clear();
  traceRequestSeed.value += 1;
  traces.value = [];
  tracePage.value = 1;
  hasNext.value = false;
  loadedMoreOnce.value = false;
  selectedTraceIds.value = new Set();
  loading.value = false;
  loadingMore.value = false;
}

function prepareTraceCacheForUser() {
  if (traceCacheUserId === sessionStore.uid) return;
  clearTraceCache();
  selectedTraceIds.value = new Set();
  traceCacheUserId = sessionStore.uid;
}

let categoryPromise: Promise<void> | null = null;

async function ensureTraceCategories(force = false) {
  if (ingredientCategories.value.length && !force) return;
  if (categoryPromise) {
    await categoryPromise;
    return;
  }
  categoryPromise = recipeApi.listIngredientCategories()
    .then(result => {
      ingredientCategories.value = result;
    })
    .finally(() => {
      categoryPromise = null;
    });
  await categoryPromise;
}

async function loadPage(options: { reset?: boolean; refreshCategories?: boolean } = {}) {
  if (!sessionStore.isLoggedIn || (loading.value && !options.reset)) return;
  const key = traceCacheKey();
  const cached = traceCache.get(key);
  if (cached && !options.reset) {
    applyTraceCache(cached);
    return;
  }
  const requestId = ++traceRequestSeed.value;
  loading.value = true;
  loadingMore.value = false;
  moreErrorText.value = "";
  if (!cached) errorText.value = "";
  try {
    await ensureTraceCategories(options.refreshCategories);
    const result = await fridgeApi.list(1, 20, categoryFilter.value ?? undefined);
    if (requestId !== traceRequestSeed.value || key !== traceCacheKey()) return;
    const nextCache = {
      items: result.items,
      page: result.page,
      hasNext: result.hasNext,
      loadedMoreOnce: false
    };
    traceCache.set(key, nextCache);
    applyTraceCache(nextCache);
    errorText.value = "";
  } catch (error) {
    if (requestId === traceRequestSeed.value && key === traceCacheKey()) {
      const message = error instanceof Error ? error.message : "食材参考加载失败";
      if (cached) {
        applyTraceCache(cached);
        await uniPlatform.feedback.toast({ title: message, icon: "none" });
      } else {
        errorText.value = message;
      }
    }
  } finally {
    if (requestId === traceRequestSeed.value) loading.value = false;
  }
}

async function loadMoreTraces() {
  if (loading.value || loadingMore.value || !hasNext.value) return false;
  const requestId = traceRequestSeed.value;
  const key = traceCacheKey();
  const nextPage = tracePage.value + 1;
  loadingMore.value = true;
  moreErrorText.value = "";
  try {
    const result = await fridgeApi.list(nextPage, 20, categoryFilter.value ?? undefined);
    if (requestId !== traceRequestSeed.value || key !== traceCacheKey()) return false;
    const nextCache: TracePageCache = {
      items: [...traces.value, ...result.items],
      page: result.page,
      hasNext: result.hasNext,
      loadedMoreOnce: true
    };
    traceCache.set(key, nextCache);
    applyTraceCache(nextCache);
    return true;
  } catch (error) {
    if (requestId === traceRequestSeed.value && key === traceCacheKey()) {
      moreErrorText.value = error instanceof Error ? error.message : "食材加载失败";
    }
    return false;
  } finally {
    if (requestId === traceRequestSeed.value) loadingMore.value = false;
  }
}

function handleScrollToLower() {
  void loadMoreTraces();
}

function handleTraceScroll(event: { detail?: { scrollTop?: number } }) {
  traceScrollTop.value = event.detail?.scrollTop ?? 0;
}

async function handleRefresherRefresh() {
  if (!onRefresherRefresh()) {
    onRefresherRestore();
    return;
  }
  try {
    await loadPage({ reset: true, refreshCategories: true });
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

function formatRecordedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近";
  return `${date.getMonth() + 1}月${date.getDate()}日记录`;
}

function changeCategory(categoryId: UUID | null) {
  if (categoryFilter.value === categoryId) return;
  categoryFilter.value = categoryId;
  traceScrollTop.value = 0;
  selectedTraceIds.value = new Set();
  archiveExpanded.value = false;
  errorText.value = "";
  moreErrorText.value = "";
  traceRequestSeed.value += 1;
  loading.value = false;
  loadingMore.value = false;
  const cached = traceCache.get(traceCacheKey());
  if (cached) applyTraceCache(cached);
  else {
    traces.value = [];
    tracePage.value = 1;
    hasNext.value = false;
    loadedMoreOnce.value = false;
    selectingAll.value = false;
    void loadPage({ reset: true });
  }
}

function openAddSheet() {
  ingredientKeyword.value = "";
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  selectedIngredients.value = [];
  ingredientErrorText.value = "";
  addSheetVisible.value = true;
  void loadAddSheetIngredients();
}

function closeAddSheet() {
  addSheetVisible.value = false;
}

async function loadAddSheetIngredients() {
  try {
    if (!ingredientCategories.value.length) ingredientCategories.value = await recipeApi.listIngredientCategories();
    await loadIngredientOptions(true);
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
  }
}

function handleAddSheetAfterClose() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  ingredientKeyword.value = "";
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  ingredientErrorText.value = "";
  ingredientOptions.value = [];
  selectedIngredients.value = [];
}

async function loadIngredientOptions(reset: boolean) {
  if (!reset && (ingredientLoading.value || ingredientLoadingMore.value || !ingredientHasNext.value)) return;
  const requestId = ingredientRequestSeed.value + 1;
  ingredientRequestSeed.value = requestId;
  const keyword = ingredientKeyword.value.trim();
  const searchMode = Boolean(keyword);
  const nextPage = reset ? 1 : ingredientPage.value + 1;
  if (reset) {
    ingredientLoading.value = true;
    ingredientOptions.value = [];
    ingredientLoadedKeyword.value = "";
    ingredientSearchPending.value = searchMode;
  } else ingredientLoadingMore.value = true;
  ingredientErrorText.value = "";
  try {
    const result = await recipeApi.listIngredients({
      page: nextPage,
      pageSize: searchMode ? 20 : 48,
      keyword: keyword || undefined,
      categoryId: searchMode ? undefined : ingredientCategoryId.value || undefined,
      source: searchMode ? undefined : ingredientSourceFilter.value
    });
    if (requestId !== ingredientRequestSeed.value) return;
    ingredientPage.value = result.page;
    ingredientHasNext.value = result.hasNext;
    ingredientLoadedKeyword.value = keyword;
    ingredientSearchPending.value = false;
    if (reset) ingredientOptions.value = result.items;
    else {
      const itemMap = new Map(ingredientOptions.value.map(item => [item.id, item]));
      result.items.forEach(item => itemMap.set(item.id, item));
      ingredientOptions.value = Array.from(itemMap.values());
    }
  } catch (error) {
    if (requestId === ingredientRequestSeed.value) {
      ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
      ingredientSearchPending.value = false;
    }
  } finally {
    if (requestId === ingredientRequestSeed.value) {
      ingredientLoading.value = false;
      ingredientLoadingMore.value = false;
    }
  }
}

function searchIngredients() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  void loadIngredientOptions(true);
}

function exitIngredientSearch() {
  if (ingredientSearchTimer) clearTimeout(ingredientSearchTimer);
  ingredientSearchTimer = null;
  ingredientKeyword.value = "";
}

function clearIngredientCategory() {
  ingredientCategoryId.value = "";
  ingredientSourceFilter.value = "ALL";
  void loadIngredientOptions(true);
}

function changeIngredientCategory(categoryId: UUID) {
  ingredientCategoryId.value = ingredientCategoryId.value === categoryId ? "" : categoryId;
  void loadIngredientOptions(true);
}

function changeIngredientSourceFilter(source: "PERSONAL") {
  ingredientSourceFilter.value = ingredientSourceFilter.value === source ? "ALL" : source;
  void loadIngredientOptions(true);
}

function loadMoreIngredients() {
  void loadIngredientOptions(false);
}

function selectIngredient(ingredientId: UUID) {
  if (existingIngredientIds.value.includes(ingredientId)) return;
  const selectedIndex = selectedIngredients.value.findIndex(item => item.id === ingredientId);
  const ingredient = ingredientOptions.value.find(item => item.id === ingredientId);
  if (!ingredient) return;
  selectedIngredients.value = selectedIndex >= 0
    ? selectedIngredients.value.filter(item => item.id !== ingredientId)
    : [...selectedIngredients.value, ingredient];
}

function removeSelectedIngredient(ingredientId: UUID) {
  selectedIngredients.value = selectedIngredients.value.filter(item => item.id !== ingredientId);
}

async function addSelectedIngredients() {
  if (!selectedIngredients.value.length || submitting.value) return;
  const selected = selectedIngredients.value.filter(item => !existingIngredientIds.value.includes(item.id));
  if (!selected.length) {
    closeAddSheet();
    return;
  }
  submitting.value = true;
  try {
    await fridgeApi.markPresentBatch(selected.map(ingredient => ({ ingredientId: ingredient.id, name: ingredient.name })), createOperationId());
    closeAddSheet();
    clearTraceCache();
    await loadPage({ reset: true });
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "添加失败";
  } finally {
    submitting.value = false;
  }
}

function openShopping() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function enterManageMode() {
  manageMode.value = true;
  selectedTraceIds.value = new Set();
}

function exitManageMode() {
  manageMode.value = false;
  selectedTraceIds.value = new Set();
}

async function toggleSelectAll() {
  if (selectingAll.value || loading.value || loadingMore.value) return;
  if (!allVisibleSelected.value && hasNext.value) {
    selectingAll.value = true;
    try {
      while (hasNext.value) {
        const loaded = await loadMoreTraces();
        if (!loaded) return;
      }
    } finally {
      selectingAll.value = false;
    }
  }
  const next = new Set(selectedTraceIds.value);
  for (const trace of selectableTraces.value) {
    if (allVisibleSelected.value) next.delete(trace.id);
    else next.add(trace.id);
  }
  selectedTraceIds.value = next;
}

function toggleTraceSelected(trace: FridgeTraceSummary) {
  const next = new Set(selectedTraceIds.value);
  if (next.has(trace.id)) next.delete(trace.id);
  else next.add(trace.id);
  selectedTraceIds.value = next;
}

async function confirmMarkSelectedEmpty() {
  if (!selectedTraceIds.value.size || updatingTraces.value || loading.value) return;
  const selected = traces.value.filter(trace => selectedTraceIds.value.has(trace.id));
  if (!selected.length) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "整理食材",
    content: `将选中的 ${selected.length} 种食材记为“家里没有”吗？`
  });
  if (!confirmed) return;

  updatingTraces.value = true;
  try {
    await fridgeApi.markEmptyBatch(selected.map(trace => ({
      ingredientId: trace.ingredientId,
      name: trace.name,
      categoryName: trace.categoryName
    })), createOperationId());
    exitManageMode();
    clearTraceCache();
    await loadPage({ reset: true });
    await uniPlatform.feedback.toast({
      title: errorText.value ? "已更新食材，列表刷新失败" : "已更新食材状态",
      icon: errorText.value ? "none" : "success"
    });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "更新食材状态失败", icon: "none" });
  } finally {
    updatingTraces.value = false;
  }
}
</script>

<style scoped>
.trace-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.trace-scroll-wrap {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.trace-scroll {
  flex: 1;
  height: 1px;
  min-height: 0;
}

.trace-content {
  padding: 30rpx 28rpx 24rpx;
}

.trace-card {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}

.trace-intro {
  display: block;
  margin-bottom: 20rpx;
  color: var(--color-text-secondary);
  font-size: 27rpx;
  line-height: 1.6;
}

.trace-manage {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0;
  margin: 0 -28rpx 20rpx;
  padding: 10rpx 28rpx;
  border-bottom: 1rpx solid var(--color-divider);
  background: var(--color-page);
}

.trace-category-fixed {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  padding-right: 12rpx;
  background: var(--color-page);
}

.trace-category-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.trace-category-row {
  display: flex;
  gap: 16rpx;
  width: max-content;
  padding-right: 100rpx;
}

.trace-category-chip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  box-sizing: border-box;
  font-size: 23rpx;
  white-space: nowrap;
}

.trace-category-chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.trace-manage__actions {
  position: absolute;
  top: 0;
  right: 28rpx;
  bottom: 0;
  z-index: 4;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 18rpx;
  padding-left: 28rpx;
  background: var(--page-edge-fade-bg);
}

.trace-manage__action {
  color: var(--theme-primary);
  font-size: 24rpx;
  white-space: nowrap;
}

.trace-card__name {
  color: var(--color-text);
  font-weight: 700;
}

.archive-toggle {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.archive-section {
  margin-top: 28rpx;
}

.archive-toggle {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 24rpx;
}

.trace-card--archived {
  opacity: 0.78;
}

.trace-card__category,
.trace-card__label,
.trace-card__window {
  color: var(--color-text-secondary);
}

.trace-state {
  padding: 100rpx 30rpx;
  color: var(--color-text-secondary);
  text-align: center;
}

.trace-state--error {
  color: var(--color-state-danger-text);
}

.trace-empty {
  margin-top: 60rpx;
}

.trace-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.trace-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 24rpx;
}

.trace-card--manage {
  cursor: pointer;
}

.trace-card__main {
  min-width: 0;
  flex: 1;
}

.trace-card__body {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-width: 0;
}

.trace-card__select {
  display: flex;
  flex: 0 0 58rpx;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border: 3rpx solid var(--color-text);
  border-radius: 18rpx 24rpx 16rpx 22rpx / 22rpx 16rpx 24rpx 18rpx;
  background: var(--color-surface-raised);
  box-shadow: 4rpx 4rpx 0 var(--color-text);
  box-sizing: border-box;
  transition:
    transform 180ms cubic-bezier(0.175, 0.885, 0.32, 1.275),
    box-shadow 180ms ease,
    background-color 180ms ease,
    border-radius 180ms ease;
}

.trace-card__select--checked {
  border-radius: 24rpx 16rpx 22rpx 18rpx / 16rpx 24rpx 18rpx 22rpx;
  background: var(--button-primary-bg);
  transform: scale(1.05) rotate(-2deg);
}

.trace-card__select:active {
  box-shadow: 0 0 0 var(--color-text);
  transform: scale(0.92) translateY(3rpx);
}

.trace-card__check-icon {
  color: var(--button-primary-text);
  font-size: 38rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
  animation: trace-purchase-check-pop 240ms cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes trace-purchase-check-pop {
  0% {
    opacity: 0;
    transform: scale(0.42) rotate(-12deg);
  }
  64% {
    transform: scale(1.24) rotate(5deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}

.trace-card__name {
  max-width: 360rpx;
  overflow: hidden;
  font-size: 30rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-card__window {
  flex: none;
  font-size: 20rpx;
}

.trace-card__category,
.trace-card__label {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
}

.trace-card__label {
  flex: 0 1 240rpx;
  margin-top: 0;
  text-align: right;
}

.trace-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 28rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--color-divider);
  background: var(--color-surface);
}

.trace-actions__footer {
  flex: 1;
  min-width: 0;
}

.trace-actions__mark-empty {
  flex: 1;
  height: 88rpx;
  margin: 0;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 88rpx;
}

.trace-actions__mark-empty {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.trace-actions__mark-empty--disabled {
  opacity: 0.48;
}
</style>
