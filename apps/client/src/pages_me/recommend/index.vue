<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="通知中心" full-screen>
    <view class="notification-page">
      <view class="notification-hero">
        <text class="notification-hero__title">通知中心</text>
        <text class="notification-hero__desc">这里统一查看推荐审核、饭局邀请、计划进度和系统消息。</text>
      </view>

      <view class="notification-panel">
        <view class="notification-panel__head">
          <text class="notification-panel__title">系统提醒</text>
          <text class="notification-panel__badge">逐步接入</text>
        </view>
        <text class="notification-panel__desc">饭局邀请、计划进度和系统消息会陆续收口到这里。当前先开放推荐审核记录。</text>
      </view>

      <view class="notification-section">
        <view class="notification-section__head">
          <view>
            <text class="notification-section__title">推荐审核</text>
            <text class="notification-section__desc">当前先支持食材推荐。后续食谱、单位等推荐也会并到这里。</text>
          </view>
        </view>

        <view v-if="loading && !items.length" class="notice">加载中...</view>
        <view v-else-if="errorText && !items.length" class="notice notice--error" @click="loadPage">{{ errorText }}</view>
        <view v-else-if="!items.length" class="empty-state">
          <text class="empty-state__title">还没有推荐审核</text>
          <text class="empty-state__desc">你在菜谱编辑里推荐个人食材后，会先在这里看到审核结果。</text>
        </view>
        <view v-else class="recommend-list">
          <view v-if="errorText" class="inline-notice" @click="loadPage">
            <text>{{ errorText }}</text>
            <text class="inline-notice__action">重试</text>
          </view>

          <view v-for="item in items" :key="item.id" class="recommend-card">
            <view class="recommend-card__head">
              <view>
                <text class="recommend-card__name">{{ item.ingredientName }}</text>
                <text class="recommend-card__meta">{{ item.category.name }} · {{ item.defaultUnit.name }}</text>
              </view>
              <text class="recommend-card__status" :class="`recommend-card__status--${statusTone(item.status)}`">
                {{ statusText(item.status) }}
              </text>
            </view>

            <text class="recommend-card__time">推荐时间 {{ formatTime(item.createdAt) }}</text>

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

          <view class="recommend-footer">
            <text v-if="loadingMore">加载更多中...</text>
            <text v-else-if="hasNext" class="recommend-footer__action" @click="loadMore">点击加载更多</text>
            <text v-else>没有更多了</text>
          </view>
        </view>
      </view>

      <view
        v-if="editorVisible"
        class="editor-mask"
        @click="closeEditor"
        @touchmove.stop.prevent
      >
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
import { reactive, ref, watch } from "vue";
import { onReachBottom, onShow } from "@dcloudio/uni-app";
import {
  recipeApi,
  type IngredientCategorySummary,
  type IngredientRecommendationStatus,
  type IngredientRecommendationSummary,
  type UnitSummary
} from "@/apis/recipe";
import type { UUID } from "@/apis/http";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { usePageScrollLock } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();

const loading = ref(false);
const loadingMore = ref(false);
const errorText = ref("");
const editorVisible = ref(false);
const editorSubmitting = ref(false);
const { setLocked: setPageLocked } = usePageScrollLock(Symbol("recommend-editor"));
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

let loadPromise: Promise<void> | null = null;

onShow(() => {
  void loadPage();
});

onReachBottom(() => {
  if (loading.value || loadingMore.value || !hasNext.value) return;
  void loadMore();
});

watch(
  () => editorVisible.value,
  (visible) => {
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
    const [recommendationResult, categoryList, unitResult] = await Promise.all([
      recipeApi.listIngredientRecommendations({ page: nextPage, pageSize: pageSize.value }),
      reset || !categories.value.length ? recipeApi.listIngredientCategories() : Promise.resolve(null),
      reset || !units.value.length ? recipeApi.listUnits({ page: 1, pageSize: 100 }) : Promise.resolve(null)
    ]);
    page.value = recommendationResult.page;
    hasNext.value = recommendationResult.hasNext;
    items.value = reset ? recommendationResult.items : [...items.value, ...recommendationResult.items];
    if (categoryList) {
      categories.value = categoryList;
    }
    if (unitResult) {
      units.value = unitResult.items;
    }
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

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hour}:${minute}`;
}

function openEditor(item: IngredientRecommendationSummary) {
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

  const ingredientId = editorForm.ingredientId;
  const categoryId = editorForm.categoryId;
  const defaultUnitId = editorForm.defaultUnitId;

  editorSubmitting.value = true;
  try {
    await recipeApi.updateIngredient(ingredientId, {
      operationId: createOperationId(),
      expectedVersion: editorForm.expectedVersion,
      name,
      categoryId,
      defaultUnitId
    });
    await recipeApi.recommendIngredient(ingredientId, {
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
.notification-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  background: var(--color-page);
}

.notification-hero,
.notification-panel,
.notification-section,
.recommend-card,
.editor-panel,
.empty-state,
.notice,
.inline-notice {
  border-radius: var(--radius-card);
  background: var(--color-card);
  box-shadow: var(--shadow-card);
}

.notification-hero,
.notification-panel,
.notification-section,
.empty-state,
.notice,
.inline-notice,
.recommend-card,
.editor-panel {
  padding: 28rpx;
}

.notification-hero,
.notification-panel,
.notification-section {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 24rpx;
}

.notification-hero__title,
.notification-panel__title,
.notification-section__title,
.recommend-card__name,
.editor-panel__title,
.empty-state__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.notification-hero__desc,
.notification-panel__desc,
.notification-section__desc,
.recommend-card__meta,
.recommend-card__time,
.recommend-card__desc,
.empty-state__desc,
.notice,
.inline-notice {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notification-panel__head,
.notification-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.notification-panel__badge {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 22rpx;
  font-weight: var(--font-weight-semibold);
}

.recommend-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.recommend-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.recommend-card__reject {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.recommend-footer {
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.recommend-footer__action {
  color: var(--color-primary);
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

.recommend-card__status {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
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

.recommend-card__actions {
  display: flex;
  justify-content: flex-end;
}

.recommend-card__advice {
  color: #d29322;
  font-size: 24rpx;
  line-height: 1.6;
}

.recommend-button,
.editor-button {
  height: 76rpx;
  padding: 0 30rpx;
  border: 0;
  border-radius: var(--radius-pill);
  color: #fff;
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 76rpx;
  background: var(--color-primary);
}

.editor-button--ghost {
  color: var(--color-text);
  background: var(--color-fill-2);
}

.empty-state,
.notice {
  text-align: center;
}

.notice--error,
.inline-notice__action {
  color: var(--color-primary);
}

.editor-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: flex-end;
  background: rgba(23, 35, 29, 0.38);
  -webkit-backdrop-filter: blur(24rpx) saturate(145%);
  backdrop-filter: blur(24rpx) saturate(145%);
}

.editor-panel {
  width: 100%;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.editor-panel__close {
  color: var(--color-text-secondary);
  font-size: 40rpx;
  line-height: 1;
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.editor-field__label {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-medium);
}

.editor-input {
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-fill-2);
  color: var(--color-text);
  font-size: 28rpx;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  min-width: 120rpx;
  padding: 18rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-fill-2);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  text-align: center;
}

.chip--active {
  background: rgba(255, 114, 87, 0.14);
  color: var(--color-primary);
}

.editor-actions {
  margin-top: 32rpx;
}
</style>
