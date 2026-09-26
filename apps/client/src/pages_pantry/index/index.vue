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
      <view class="trace-intro">
        <text class="trace-intro__title">只做参考，不做库存记账</text>
        <text class="trace-intro__description">这里只记得食材“有 / 没有”，不记录数量。久未确认的记录会自动变成未确认。</text>
        <view class="trace-intro__actions">
          <button class="trace-intro__button" @click="openAddSheet">添加食材</button>
          <button class="trace-intro__button" @click="openShopping">去看购物清单</button>
        </view>
      </view>

      <view v-if="loading" class="trace-state">加载中...</view>
      <view v-else-if="errorText" class="trace-state trace-state--error" @click="loadPage">{{ errorText }}，点此重试</view>
      <Empty
        v-else-if="!traces.length"
        class="trace-empty"
        :art="emptyStateArt"
        title="还没有记录的食材"
        description="可以手动添加，或在购物清单里勾选已买后自动记录。"
      />
      <view v-else class="trace-list">
        <view v-for="trace in currentTraces" :key="trace.id" class="trace-card">
          <view class="trace-card__main">
            <view class="trace-card__name-row">
              <text class="trace-card__name">{{ trace.name }}</text>
              <text class="trace-card__presence" :class="`trace-card__presence--${trace.presence.toLowerCase()}`">
                {{ presenceLabel(trace.presence) }}
              </text>
            </view>
            <text class="trace-card__category">{{ trace.categoryName || "未分类" }}</text>
            <text class="trace-card__label">{{ trace.label }} · {{ formatRecordedAt(trace.recordedAt) }}</text>
          </view>
          <view class="trace-card__actions">
            <button class="trace-card__action" @click="markPresent(trace)">确认还有</button>
            <button class="trace-card__action trace-card__action--muted" @click="markEmpty(trace)">标记没有</button>
          </view>
        </view>
      </view>

      <view v-if="archivedTraces.length" class="archive-section">
        <button class="archive-toggle" @click="archiveExpanded = !archiveExpanded">
          <text>很久没记录（{{ archivedTraces.length }} 项）</text>
          <text>{{ archiveExpanded ? "收起" : "展开" }}</text>
        </button>
        <view v-if="archiveExpanded" class="trace-list">
          <view v-for="trace in archivedTraces" :key="trace.id" class="trace-card trace-card--archived">
            <view class="trace-card__main">
              <view class="trace-card__name-row">
                <text class="trace-card__name">{{ trace.name }}</text>
                <text class="trace-card__presence trace-card__presence--unconfirmed">未确认</text>
              </view>
              <text class="trace-card__category">{{ trace.categoryName || "未分类" }}</text>
              <text class="trace-card__label">{{ formatRecordedAt(trace.recordedAt) }} · 超过 30 天未更新</text>
            </view>
            <view class="trace-card__actions">
              <button class="trace-card__action" @click="markPresent(trace)">确认还有</button>
              <button class="trace-card__action trace-card__action--muted" @click="markEmpty(trace)">标记没有</button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <SheetShell :visible="addSheetVisible" title="添加食材" subtitle="添加后默认标记为有，不填写数量。" @close="closeAddSheet">
      <view class="add-search">
        <input v-model="ingredientKeyword" class="add-search__input" placeholder="搜索食材" confirm-type="search" @confirm="searchIngredients" />
        <button class="add-search__button" @click="searchIngredients">搜索</button>
      </view>
      <view v-if="ingredientLoading" class="trace-state">搜索中...</view>
      <view v-else-if="ingredientErrorText" class="trace-state trace-state--error">{{ ingredientErrorText }}</view>
      <scroll-view v-else class="ingredient-results" scroll-y>
        <view v-for="ingredient in ingredientOptions" :key="ingredient.id" class="ingredient-option" @click="addIngredient(ingredient)">
          <text>{{ ingredient.name }}</text>
          <text>{{ ingredient.source === "PERSONAL" ? "个人食材" : "系统食材" }}</text>
        </view>
        <text v-if="!ingredientOptions.length" class="sheet-note">没有找到食材，请换个关键词搜索。</text>
      </scroll-view>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { recipeApi, type IngredientSummary } from "@/apis/recipe";
import { useLoginEmptyState } from "@/composables/useLoginEmptyState";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { fridgeApi, type FridgeTraceSummary } from "../apis/fridge";
import { loadAllFridgeTraces } from "../utils/fridge-traces";

const { themeVars, themeClasses } = useTheme();
const pageStyle = usePageScrollStyle();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(handleLoginSuccess);
const traces = ref<FridgeTraceSummary[]>([]);
const currentTraces = computed(() => traces.value.filter(trace => !trace.archived));
const archivedTraces = computed(() => traces.value.filter(trace => trace.archived));
const loading = ref(false);
const errorText = ref("");
const archiveExpanded = ref(false);
const addSheetVisible = ref(false);
const ingredientKeyword = ref("");
const ingredientLoading = ref(false);
const ingredientErrorText = ref("");
const ingredientOptions = ref<IngredientSummary[]>([]);

onShow(() => {
  if (sessionStore.isLoggedIn) void loadPage();
});

async function handleLoginSuccess() {
  await loadPage();
}

async function loadPage() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    traces.value = await loadAllFridgeTraces((page, pageSize) => fridgeApi.list(page, pageSize));
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "食材参考加载失败";
  } finally {
    loading.value = false;
  }
}

function formatRecordedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近";
  return `${date.getMonth() + 1}月${date.getDate()}日记录`;
}

function presenceLabel(presence: FridgeTraceSummary["presence"]) {
  if (presence === "PRESENT") return "有";
  if (presence === "EMPTY") return "没有";
  return "未确认";
}

function openAddSheet() {
  addSheetVisible.value = true;
  ingredientKeyword.value = "";
  ingredientErrorText.value = "";
  void searchIngredients();
}

function closeAddSheet() {
  addSheetVisible.value = false;
  ingredientOptions.value = [];
}

async function searchIngredients() {
  ingredientLoading.value = true;
  ingredientErrorText.value = "";
  try {
    const result = await recipeApi.listIngredients({ page: 1, pageSize: 30, keyword: ingredientKeyword.value.trim() || undefined, source: "ALL" });
    ingredientOptions.value = result.items;
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "食材加载失败";
  } finally {
    ingredientLoading.value = false;
  }
}

async function addIngredient(ingredient: IngredientSummary) {
  try {
    await fridgeApi.markPresent({
      operationId: createOperationId(),
      ingredientId: ingredient.id,
      name: ingredient.name
    });
    closeAddSheet();
    await loadPage();
  } catch (error) {
    ingredientErrorText.value = error instanceof Error ? error.message : "添加失败";
  }
}

async function markPresent(trace: FridgeTraceSummary) {
  try {
    await fridgeApi.markPresent({
      operationId: createOperationId(),
      ingredientId: trace.ingredientId,
      name: trace.name,
      categoryName: trace.categoryName
    });
    await loadPage();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "更新痕迹失败";
  }
}

async function markEmpty(trace: FridgeTraceSummary) {
  try {
    await fridgeApi.markEmpty({
      operationId: createOperationId(),
      ingredientId: trace.ingredientId,
      name: trace.name,
      categoryName: trace.categoryName
    });
    await loadPage();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "更新状态失败";
  }
}

function openShopping() {
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}
</script>

<style scoped>
.trace-page {
  padding: 30rpx 28rpx 60rpx;
}

.trace-intro,
.trace-card {
  border-radius: 28rpx;
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}

.trace-intro {
  padding: 30rpx;
  margin-bottom: 24rpx;
}

.trace-intro__title,
.trace-card__name {
  color: var(--color-text);
  font-weight: 700;
}

.trace-card__presence,
.archive-toggle {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.trace-card__presence--present {
  background: var(--color-state-success-soft);
  color: var(--color-state-success-text);
}

.trace-card__presence--empty {
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
}

.trace-card__presence--unconfirmed {
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
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

.add-search {
  display: flex;
  gap: 12rpx;
  padding: 20rpx 24rpx;
}

.add-search__input {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border-radius: 16rpx;
  background: var(--color-surface-muted);
}

.add-search__button {
  padding: 0 24rpx;
  border-radius: 16rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.ingredient-results {
  max-height: 540rpx;
  padding: 0 24rpx 24rpx;
  box-sizing: border-box;
}

.ingredient-option {
  display: flex;
  justify-content: space-between;
  padding: 24rpx 8rpx;
  border-bottom: 1rpx solid var(--color-divider);
  color: var(--color-text);
}

.ingredient-option text:last-child {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.trace-intro__title {
  display: block;
  font-size: 34rpx;
}

.trace-intro__description,
.trace-card__category,
.trace-card__label,
.trace-card__window {
  color: var(--color-text-secondary);
}

.trace-intro__description {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.65;
}

.trace-intro__actions,
.trace-card__actions {
  display: flex;
  gap: 16rpx;
}

.trace-intro__actions {
  margin-top: 24rpx;
}

.trace-intro__button,
.trace-card__action {
  border: 0;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 24rpx;
  line-height: 68rpx;
}

.trace-intro__button {
  flex: 1;
}

.trace-intro__button--plain,
.trace-card__action--muted {
  background: var(--color-surface-muted);
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

.trace-card__main {
  min-width: 0;
  flex: 1;
}

.trace-card__name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
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

.trace-card__actions {
  flex: none;
}

.trace-card__action {
  min-width: 92rpx;
  padding: 0 18rpx;
  line-height: 56rpx;
}
</style>
