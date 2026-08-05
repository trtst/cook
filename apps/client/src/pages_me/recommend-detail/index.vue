<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen navbar-transparent :navbar-placeholder="false">
    <template #navbar-center>
      <text class="detail-navbar__title">{{ currentType.name }}</text>
    </template>

    <view class="detail-nav-backdrop" :style="navBackdropStyle" />

    <view class="detail-page">
      <scroll-view scroll-y class="detail-scroll" show-scrollbar="false" @scroll="handleScroll">
        <view class="detail-body" :style="detailBodyStyle">
          <view class="sticky-wrap" :style="stickyStyle">
            <view class="status-panel">
              <view
                v-for="item in statusTabs"
                :key="item.key"
                class="status-chip"
                :class="{ 'status-chip--active': activeStatus === item.key }"
                @click="changeStatus(item.key)"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view v-if="loading && !items.length" class="notice">加载中...</view>
          <view v-else-if="errorText && !items.length" class="notice notice--error" @click="loadPage()">
            {{ errorText }}
          </view>
          <view v-else-if="!filteredItems.length" class="empty-state">
            <image class="empty-state__art" :src="emptyStateArt" mode="aspectFit" />
            <text class="empty-state__title">{{ emptyTitle }}</text>
            <text class="empty-state__desc">{{ emptyDesc }}</text>
          </view>
          <view v-else class="recommend-list">
            <view v-if="errorText" class="inline-notice" @click="loadPage()">
              <text>{{ errorText }}</text>
              <text class="inline-notice__action">重试</text>
            </view>

            <view v-for="item in filteredItems" :key="item.id" class="recommend-card">
              <view class="recommend-card__head">
                <view class="recommend-card__head-main">
                  <text class="recommend-card__name">{{ item.ingredientName }}</text>
                  <text class="recommend-card__meta">{{ item.category.name }} · {{ item.defaultUnit.name }}</text>
                </view>
                <text class="recommend-card__status" :class="`recommend-card__status--${statusTone(item.status)}`">
                  {{ statusText(item.status) }}
                </text>
              </view>

              <text class="recommend-card__time">推荐时间 {{ formatDetailTime(item.createdAt) }}</text>

              <text v-if="item.status === 'PENDING'" class="recommend-card__desc">等待审核中，当前仍可在菜谱编辑里继续使用这份个人食材。</text>
              <view v-else-if="item.status === 'REJECTED'" class="recommend-card__reject">
                <text class="recommend-card__desc">
                  {{ item.reviewNote || "审核未通过，可修改名称、分类或默认单位后重新推荐。" }}
                </text>
                <text v-if="item.reviewAdvice" class="recommend-card__advice">建议：{{ item.reviewAdvice }}</text>
              </view>
              <text v-else-if="item.status === 'ADOPTED'" class="recommend-card__desc">
                已收录为系统食材{{ item.adoptedIngredient ? `：${item.adoptedIngredient.name}` : "" }}
              </text>
              <text v-else class="recommend-card__desc">
                已归并到现有系统食材{{ item.mergedIngredient ? `：${item.mergedIngredient.name}` : "" }}
              </text>

              <view v-if="item.status === 'REJECTED'" class="recommend-card__actions">
                <button class="recommend-button" :disabled="editorSubmitting" @click="openEditor(item)">修改后重新推荐</button>
              </view>
            </view>

            <view v-if="hasNext" class="recommend-footer">
              <text class="recommend-footer__action" @click="loadMore">点击加载更多</text>
            </view>
          </view>
        </view>
      </scroll-view>

      <view v-if="editorVisible" class="editor-mask" @click="closeEditor" @touchmove.stop.prevent>
        <view class="editor-panel" @click.stop>
          <view class="editor-panel__head">
            <text class="editor-panel__title">修改并重新推荐</text>
            <text class="editor-panel__close" @click="closeEditor">×</text>
          </view>

          <view class="editor-field">
            <text class="editor-field__label">食材名称</text>
            <input
              v-model="editorForm.name"
              class="editor-input"
              maxlength="30"
              placeholder="请输入食材名称"
              :disabled="editorSubmitting"
            />
          </view>

          <view class="editor-field">
            <text class="editor-field__label">分类</text>
            <view class="chip-row">
              <view
                v-for="item in categories"
                :key="item.id"
                class="chip"
                :class="{ 'chip--active': editorForm.categoryId === item.id }"
                @click="editorForm.categoryId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="editor-field">
            <text class="editor-field__label">默认单位</text>
            <view class="chip-row">
              <view
                v-for="item in units"
                :key="item.id"
                class="chip"
                :class="{ 'chip--active': editorForm.defaultUnitId === item.id }"
                @click="editorForm.defaultUnitId = item.id"
              >
                {{ item.name }}
              </view>
            </view>
          </view>

          <view class="editor-actions">
            <button class="editor-button editor-button--ghost" :disabled="editorSubmitting" @click="closeEditor">取消</button>
            <button class="editor-button" :loading="editorSubmitting" :disabled="editorSubmitting" @click="submitEditor">
              保存并推荐
            </button>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import emptyStateArt from "@/assets/me-page/notification-empty-state.svg";
import {
  recipeApi,
  type IngredientCategorySummary,
  type IngredientRecommendationStatus,
  type IngredientRecommendationSummary,
  type UnitSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";

type MessageTypeKey = "ingredient";
type StatusFilterKey = "ALL" | IngredientRecommendationStatus;
type ReadState = Partial<Record<MessageTypeKey, string>>;

const READ_STORAGE_KEY = "cook_meal_notification_category_read_v1";
const NAV_FADE_DISTANCE = 88;

const pageStyle = usePageScrollStyle();
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recommend-detail-editor"));
const { navBarTotalHeight } = useSystemInfo();

const typeMap = {
  ingredient: {
    key: "ingredient" as MessageTypeKey,
    name: "推荐审核"
  }
} as const;

const statusTabs = [
  { key: "ALL", name: "全部" },
  { key: "PENDING", name: "审核中" },
  { key: "REJECTED", name: "已拒绝" },
  { key: "ADOPTED", name: "已收录" },
  { key: "MERGED", name: "已归并" }
] as const satisfies Array<{ key: StatusFilterKey; name: string }>;

const typeKey = ref<MessageTypeKey>("ingredient");
const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const editorVisible = ref(false);
const editorSubmitting = ref(false);
const activeStatus = ref<StatusFilterKey>("ALL");
const scrollTop = ref(0);
const items = ref<IngredientRecommendationSummary[]>([]);
const categories = ref<IngredientCategorySummary[]>([]);
const units = ref<UnitSummary[]>([]);
const page = ref(1);
const pageSize = ref(20);
const hasNext = ref(false);
const editorForm = reactive({
  ingredientId: "" as UUID | "",
  expectedVersion: 0,
  name: "",
  categoryId: "" as UUID | "",
  defaultUnitId: "" as UUID | ""
});

const currentType = computed(() => typeMap[typeKey.value]);
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const detailBodyStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + 20}px`
}));
const stickyStyle = computed(() => ({
  top: `${navBarTotalHeight.value}px`
}));
const filteredItems = computed(() => {
  if (activeStatus.value === "ALL") return items.value;
  return items.value.filter(item => item.status === activeStatus.value);
});
const emptyTitle = computed(() => (activeStatus.value === "ALL" ? "还没有推荐审核" : "这个状态下还没有记录"));
const emptyDesc = computed(() =>
  activeStatus.value === "ALL"
    ? "你在菜谱编辑里推荐个人食材后，会先在这里看到审核结果。"
    : "换个状态看看，或者稍后再回来。"
);

let loadPromise: Promise<void> | null = null;

onLoad(query => {
  const nextType = typeof query?.type === "string" ? decodeURIComponent(query.type) : "ingredient";
  typeKey.value = nextType === "ingredient" ? "ingredient" : "ingredient";
});

onShow(() => {
  void loadPage();
});

watch(
  () => editorVisible.value,
  visible => {
    setPageLocked(visible);
  },
  { immediate: true }
);

async function loadPage() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = doLoadPage(true).finally(() => {
    loadPromise = null;
  });

  await loadPromise;
}

async function loadMore() {
  if (loading.value || loadingMore.value || !hasNext.value) return;
  await doLoadPage(false);
}

async function doLoadPage(reset: boolean) {
  if (reset) {
    loading.value = true;
    errorText.value = "";
  } else {
    loadingMore.value = true;
  }

  try {
    const nextPage = reset ? 1 : page.value + 1;
    const recommendationResult = await recipeApi.listIngredientRecommendations({ page: nextPage, pageSize: pageSize.value });
    page.value = recommendationResult.page;
    hasNext.value = recommendationResult.hasNext;
    items.value = reset ? recommendationResult.items : [...items.value, ...recommendationResult.items];
    markTypeRead();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
  } finally {
    if (reset) {
      loading.value = false;
    } else {
      loadingMore.value = false;
    }
  }
}

async function ensureEditorMeta() {
  if (categories.value.length && units.value.length) return;
  const [categoryList, unitResult] = await Promise.all([
    categories.value.length ? Promise.resolve(categories.value) : recipeApi.listIngredientCategories(),
    units.value.length ? Promise.resolve({ items: units.value }) : recipeApi.listUnits({ page: 1, pageSize: 100 })
  ]);
  categories.value = categoryList;
  units.value = unitResult.items;
}

function getItemSortTime(item: IngredientRecommendationSummary) {
  return item.reviewedAt || item.updatedAt || item.createdAt;
}

function markTypeRead() {
  const latest = items.value.reduce<IngredientRecommendationSummary | null>((current, item) => {
    if (!current) return item;
    return new Date(getItemSortTime(item)).getTime() > new Date(getItemSortTime(current)).getTime() ? item : current;
  }, null);
  if (!latest) return;
  const readState = uniPlatform.storage.getSync<ReadState>(READ_STORAGE_KEY) ?? {};
  uniPlatform.storage.setSync(READ_STORAGE_KEY, {
    ...readState,
    [typeKey.value]: getItemSortTime(latest)
  });
}

function handleScroll(event: { detail: { scrollTop?: number } }) {
  scrollTop.value = event.detail.scrollTop ?? 0;
}

function changeStatus(status: StatusFilterKey) {
  if (activeStatus.value === status) return;
  activeStatus.value = status;
}

function statusText(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "审核中";
  if (status === "REJECTED") return "已拒绝";
  if (status === "ADOPTED") return "已收录";
  return "已归并";
}

function statusTone(status: IngredientRecommendationStatus) {
  if (status === "PENDING") return "pending";
  if (status === "REJECTED") return "rejected";
  if (status === "ADOPTED") return "adopted";
  return "merged";
}

function formatDetailTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

async function openEditor(item: IngredientRecommendationSummary) {
  try {
    await ensureEditorMeta();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "选项加载失败", icon: "none" });
    return;
  }
  editorForm.ingredientId = item.ingredientId;
  editorForm.expectedVersion = item.ingredientVersion;
  editorForm.name = item.ingredientName;
  editorForm.categoryId = item.category.id;
  editorForm.defaultUnitId = item.defaultUnit.id;
  editorVisible.value = true;
}

function closeEditor() {
  if (editorSubmitting.value) return;
  editorVisible.value = false;
}

async function submitEditor() {
  if (editorSubmitting.value) return;

  const name = editorForm.name.trim();
  if (!name) {
    await uniPlatform.feedback.toast({ title: "请输入食材名称", icon: "none" });
    return;
  }
  if (!editorForm.categoryId) {
    await uniPlatform.feedback.toast({ title: "请选择分类", icon: "none" });
    return;
  }
  if (!editorForm.defaultUnitId) {
    await uniPlatform.feedback.toast({ title: "请选择默认单位", icon: "none" });
    return;
  }
  if (!editorForm.ingredientId) {
    await uniPlatform.feedback.toast({ title: "食材记录缺失，请重新打开", icon: "none" });
    return;
  }

  editorSubmitting.value = true;
  try {
    await recipeApi.updateIngredient(editorForm.ingredientId, {
      operationId: createOperationId(),
      expectedVersion: editorForm.expectedVersion,
      name,
      categoryId: editorForm.categoryId,
      defaultUnitId: editorForm.defaultUnitId
    });
    await recipeApi.recommendIngredient(editorForm.ingredientId, {
      operationId: createOperationId()
    });
    editorVisible.value = false;
    await uniPlatform.feedback.toast({ title: "已重新推荐", icon: "success" });
    await loadPage();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "提交失败", icon: "none" });
  } finally {
    editorSubmitting.value = false;
  }
}
</script>

<style scoped lang="scss">
.detail-navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 790;
  background: var(--color-page);
  pointer-events: none;
}

.detail-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-page);
}

.detail-scroll {
  flex: 1;
  min-height: 0;
}

.detail-body {
  padding-right: var(--space-page);
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.sticky-wrap {
  position: sticky;
  z-index: 20;
  padding-bottom: 16rpx;
  background: var(--color-page);
}

.status-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 28rpx;
  padding: 0 4rpx;
}

.status-chip {
  position: relative;
  padding-bottom: 8rpx;
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.4;
}

.status-chip--active {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}

.status-chip--active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 6rpx;
  border-radius: 999rpx;
  background: var(--theme-primary);
}

.notice,
.empty-state,
.recommend-card,
.editor-panel,
.inline-notice {
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 32rpx rgba(28, 36, 56, 0.06);
}

.notice,
.empty-state,
.recommend-card,
.editor-panel {
  padding: 28rpx;
}

.notice,
.empty-state {
  margin-top: 20rpx;
  text-align: center;
}

.notice--error,
.inline-notice__action,
.recommend-footer__action {
  color: var(--color-primary);
}

.empty-state__art {
  display: block;
  width: 320rpx;
  height: 220rpx;
  margin: 0 auto;
}

.empty-state__title,
.recommend-card__name,
.editor-panel__title {
  color: #1f2740;
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.3;
}

.empty-state__title {
  display: block;
  margin-top: 12rpx;
}

.empty-state__desc,
.notice,
.recommend-card__meta,
.recommend-card__time,
.recommend-card__desc,
.inline-notice,
.recommend-card__advice {
  color: #8d97b5;
  font-size: 24rpx;
  line-height: 1.6;
}

.empty-state__desc {
  display: block;
  margin-top: 12rpx;
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 20rpx;
}

.inline-notice {
  padding: 24rpx 28rpx;
}

.recommend-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.recommend-card__head,
.editor-panel__head,
.editor-actions,
.inline-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.recommend-card__head {
  align-items: flex-start;
}

.recommend-card__head-main {
  min-width: 0;
}

.recommend-card__meta,
.recommend-card__time {
  display: block;
  margin-top: 8rpx;
}

.recommend-card__status {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: var(--font-weight-semibold);
}

.recommend-card__status--pending {
  color: #8c5a13;
  background: #fdf2d5;
}

.recommend-card__status--rejected {
  color: #a5412a;
  background: #fde4dd;
}

.recommend-card__status--adopted {
  color: #1d7a4f;
  background: #dff4e9;
}

.recommend-card__status--merged {
  color: #2a5d93;
  background: #e1eefb;
}

.recommend-card__reject {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.recommend-card__advice {
  color: #d29322;
}

.recommend-card__actions {
  display: flex;
  justify-content: flex-end;
}

.recommend-button,
.editor-button {
  height: 76rpx;
  padding: 0 30rpx;
  border: 0;
  border-radius: 999rpx;
  color: #ffffff;
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 76rpx;
  background: var(--color-primary);
}

.recommend-footer {
  text-align: center;
}

.editor-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(26, 26, 26, 0.42);
}

.editor-panel {
  width: calc(100% - 40rpx);
  margin-right: 20rpx;
  margin-bottom: calc(20rpx + env(safe-area-inset-bottom));
  margin-left: 20rpx;
}

.editor-panel__close {
  color: #a0a8c0;
  font-size: 40rpx;
  line-height: 1;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.editor-field__label {
  color: #1f2740;
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.editor-input {
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 18rpx;
  background: #f6f7fb;
  color: #1f2740;
  font-size: 28rpx;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid #e7eaf4;
  border-radius: 18rpx;
  box-sizing: border-box;
  background: #f6f7fb;
  color: #68718d;
  font-size: 24rpx;
}

.chip--active {
  border-color: rgba(255, 114, 87, 0.35);
  background: rgba(255, 114, 87, 0.12);
  color: var(--color-primary);
}

.editor-actions {
  margin-top: 28rpx;
}

.editor-button--ghost {
  color: #1f2740;
  background: #edf0f7;
}
</style>
