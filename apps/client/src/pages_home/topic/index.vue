<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="topic-nav-title" :style="navTitleStyle">{{ navTitle }}</text>
    </template>
    <view class="topic-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view
      scroll-y
      class="topic-scroll"
      :show-scrollbar="false"
      :scroll-into-view="scrollAnchor"
      @scroll="handleTopicScroll"
    >
      <view id="topic-top" class="topic-body">
        <view v-if="loading && !topic" class="topic-state">加载中...</view>
        <view v-else-if="errorText" class="topic-state topic-state--error" @click="reload">{{ errorText }}</view>
        <view v-else-if="!topic" class="topic-empty" :style="emptyStyle">
          <Empty title="本周灵感还在准备中" description="运营整理好本期菜单后，这里会先放出本周推荐。" />
        </view>

        <template v-else>
          <view class="topic-backdrop">
            <image v-if="topic.coverImageUrl" class="topic-backdrop__image" :src="topic.coverImageUrl" mode="aspectFill" />
            <view v-else class="topic-backdrop__image topic-backdrop__image--empty">
              <text class="topic-backdrop__empty-text">本周灵感</text>
            </view>
            <view class="topic-backdrop__blur" :style="heroStyle" />
            <view class="topic-backdrop__veil" />
          </view>

          <view class="topic-content" :style="contentStyle">
            <view class="topic-summary">
              <image v-if="topic.coverImageUrl" class="topic-summary__cover" :src="topic.coverImageUrl" mode="aspectFill" />
              <view v-else class="topic-summary__cover topic-summary__cover--empty">
                <text class="topic-summary__cover-text">灵感</text>
              </view>

              <view class="topic-summary__main">
                <view class="topic-summary__meta">
                  <text class="topic-chip">{{ topic.recTypeText }}</text>
                  <text class="topic-chip topic-chip--soft">第 {{ topic.issueNo }} 期</text>
                </view>
                <text class="topic-summary__title">{{ topic.title }}</text>
                <text v-if="topic.subTitle" class="topic-summary__sub">{{ topic.subTitle }}</text>
                <view class="topic-summary__stats">
                  <text class="topic-summary__stat">{{ topic.recipeCount }} 道推荐</text>
                  <text class="topic-summary__stat">{{ formatMonthDay(topic.updatedAt) }} 更新</text>
                </view>
              </view>
            </view>

            <view class="topic-intro">
              <text class="topic-intro__desc">{{ topic.description }}</text>
            </view>

            <view class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title">本期推荐</text>
                <text class="topic-section__meta">{{ topic.items.length }} 道</text>
              </view>

              <view class="recipe-list">
                <view
                  v-for="(item, index) in topic.items"
                  :key="item.id"
                  :class="['recipe-card', index % 2 === 1 ? 'recipe-card--reverse' : '']"
                  hover-class="recipe-card--hover"
                  hover-stay-time="100"
                  @click="openRecipe(item.id)"
                >
                  <view class="recipe-card__layout">
                    <view class="recipe-card__rail">
                      <text class="recipe-card__part">PART</text>
                      <text class="recipe-card__sort">{{ formatSort(item.sort) }}</text>
                      <view class="recipe-card__meta-group">
                        <text class="recipe-card__meta-pill">{{ item.difficultyText || "难度待补" }}</text>
                        <text class="recipe-card__meta-pill">{{ item.durationText || "时长待补" }}</text>
                      </view>
                    </view>

                    <view class="recipe-card__content">
                      <image v-if="item.coverImageUrl" class="recipe-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                      <view v-else class="recipe-card__cover recipe-card__cover--empty">
                        <text class="recipe-card__cover-text">封面图</text>
                      </view>

                      <view class="recipe-card__footer">
                        <view class="recipe-card__title-block">
                          <text class="recipe-card__title">{{ item.title }}</text>
                          <text v-if="item.recommendNote" class="recipe-card__note">{{ item.recommendNote }}</text>
                        </view>

                        <view
                          :class="[
                            'recipe-card__action',
                            item.ownedRecipeId
                              ? isQueued(item)
                                ? 'recipe-card__action--queued'
                                : 'recipe-card__action--ready'
                              : 'recipe-card__action--guide'
                          ]"
                          @click.stop="handleRecipeAction(item)"
                        >
                          <text :class="['cookfont', 'recipe-card__action-icon', recipeActionIcon(item)]" />
                          <text>{{ recipeActionText(item) }}</text>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <view class="recipe-note">
                <text class="cookfont icon-notice recipe-note__icon" />
                <view class="recipe-note__body">
                  <text class="recipe-note__line">未加入“我的菜谱”的菜，需要先添加，之后才能安排到计划。</text>
                  <text class="recipe-note__line recipe-note__line--soft">本期有喜欢的菜可以先收下，再慢慢安排。</text>
                </view>
              </view>
            </view>

            <view v-if="visibleHistory.length" class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title">往期回顾</text>
                <text class="topic-section__meta">查看更多</text>
              </view>

              <scroll-view scroll-x class="history-scroll" show-scrollbar="false">
                <view class="history-row">
                  <view
                    v-for="item in visibleHistory"
                    :key="item.id"
                    class="history-card"
                    hover-class="history-card--hover"
                    hover-stay-time="100"
                    @click="openHistory(item.id)"
                  >
                    <image v-if="item.coverImageUrl" class="history-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                    <view v-else class="history-card__cover history-card__cover--empty">
                      <text class="history-card__cover-text">往期</text>
                    </view>
                    <view class="history-card__issue">
                      <text class="history-card__issue-text">第 {{ item.issueNo }} 期</text>
                    </view>
                    <view class="history-card__mask" />
                    <text class="history-card__title">{{ item.title }}</text>
                  </view>
                </view>
              </scroll-view>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <view v-if="queuedItems.length" class="plan-queue" hover-class="plan-queue--hover" hover-stay-time="100" @click="openPlanSheet">
      <text class="cookfont icon-add-plan plan-queue__icon" />
      <text class="plan-queue__label">开始安排</text>
      <view class="plan-queue__badge">
        <text class="plan-queue__badge-text">{{ queuedItems.length }}</text>
      </view>
    </view>

    <PlanArrangeSheet
      v-if="sheetMounted"
      :visible="sheetVisible"
      title="安排这批菜"
      :subtitle="planSheetSubtitle"
      :title-extra="`${queuedItems.length}道`"
      :date="planDate"
      :month-date="planMonth"
      :meal-slot="mealSlot"
      :meal-slots="mealSlots"
      :marks="planMarks"
      :min-date="today"
      :submitting="planSubmitting"
      confirm-text="确认安排"
      confirm-loading-text="安排中..."
      @close="closePlanSheet"
      @after-close="handleSheetAfterClose"
      @month-change="handlePlanMonthChange"
      @confirm="submitPlan"
    />

    <RecipeAddSheet
      v-if="currentAddItem"
      :visible="addSheetVisible"
      :title="addSheetTitle"
      :subtitle="addSheetSubtitle"
      :category-hint="addCategoryHint"
      :scene-hint="'还没有合集，不选也可以直接加入待安排。'"
      :show-scene-section="true"
      :require-category="true"
      :submitting="addSheetSubmitting"
      @close="closeAddSheet"
      @confirm="confirmAddSheet"
    />
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
import { homeApi, type HomeTopicDetail } from "@/apis/home";
import { mealApi as commonMealApi } from "../apis/meal";
import { recipeApi } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import PlanArrangeSheet from "@/components/PlanArrangeSheet.vue";
import RecipeAddSheet from "@/components/Recipe/RecipeAddSheet.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { markRecipeHomeDirty, markRecipeManageDirty } from "@/pages/recipe/utils/recipe-view-sync";
import { uniPlatform } from "@/platform/uni";
import { formatMonthDay, formatSort, todayText } from "../utils/date";
import { isTopicQueued } from "../utils/home-topic";
import { createOperationId } from "@/utils/operation-id";
import {
  appendMealSlotToMark,
  createEmptyMealCalendarMark,
  MEAL_SLOT_OPTIONS,
  type MealCalendarMark,
  type MealSlot
} from "@/utils/meal-slot";
import { formatDateOnly, parseDateOnly } from "@/utils/date";

const pageStyle = usePageScrollStyle();
const { setLocked } = usePageScrollLock(Symbol("home-topic-sheet"));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const NAV_FADE_DISTANCE = 96;
const mealSlots = MEAL_SLOT_OPTIONS;

const loading = ref(false);
const errorText = ref("");
const topic = ref<HomeTopicDetail | null>(null);
const topicId = ref(0);
const scrollAnchor = ref("");
const scrollTop = ref(0);
const sheetMounted = ref(false);
const sheetVisible = ref(false);
const addSheetVisible = ref(false);
const addSheetSubmitting = ref(false);
const currentAddItemId = ref<number | null>(null);
const queuedIds = ref<number[]>([]);
const planSubmitting = ref(false);
const today = todayText();
const planDate = ref(todayText());
const planMonth = ref(buildMonthAnchor(planDate.value));
const planMarks = ref<Record<string, MealCalendarMark>>({});
const mealSlot = ref<MealSlot>("DINNER");
const planMarksSeq = ref(0);
const shouldRefreshOnShow = ref(false);

watch(
  () => [sheetVisible.value, addSheetVisible.value],
  ([planVisible, addVisible]) => {
    setLocked(planVisible || addVisible);
  },
  { immediate: true }
);

const heroStyle = computed(() => {
  if (!topic.value?.coverImageUrl) return {};
  return {
    backgroundImage: `url(${topic.value.coverImageUrl})`
  };
});

const contentStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 24rpx)`
}));
const emptyStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 32rpx)`
}));

const navTitle = computed(() => topic.value?.title || "本周灵感");
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const visibleHistory = computed(() => topic.value?.history.slice(0, 5) ?? []);
const queuedItems = computed(() => {
  const itemMap = new Set(queuedIds.value);
  return (topic.value?.items ?? []).filter(item => itemMap.has(item.id) && item.ownedRecipeId);
});
const currentAddItem = computed(() => (topic.value?.items ?? []).find(item => item.id === currentAddItemId.value) ?? null);
const planSheetSubtitle = computed(() => {
  return "选好日期和餐次后，待安排里的菜会一起进入这个计划。";
});
const addSheetTitle = computed(() => "添加到我的");
const addSheetSubtitle = computed(() => "先选个人分类，可选合集。确认后会自动进入待安排。");
const addCategoryHint = computed(() => "还没有个人分类，先创建一个分类再加入。");
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`,
  transform: `translateY(${(1 - navProgress.value) * 8}rpx)`
}));

onLoad(query => {
  const rawTopicId = Array.isArray(query?.topicId) ? query.topicId[0] : query?.topicId;
  topicId.value = Number.isInteger(Number(rawTopicId)) && Number(rawTopicId) > 0 ? Number(rawTopicId) : 0;
  void loadTopic();
});

onShow(() => {
  if (!shouldRefreshOnShow.value) return;
  shouldRefreshOnShow.value = false;
  void loadTopic(topicId.value, false);
});

function isQueued(item: HomeTopicDetail["items"][number]) {
  return isTopicQueued(item.id, queuedIds.value);
}

function recipeActionText(item: HomeTopicDetail["items"][number]) {
  if (!item.ownedRecipeId) return "先加入";
  return isQueued(item) ? "待安排" : "加入计划";
}

function recipeActionIcon(item: HomeTopicDetail["items"][number]) {
  if (!item.ownedRecipeId) return "icon-add-owner";
  return isQueued(item) ? "icon-add-plan" : "icon-add-list";
}

function syncQueuedItems(nextTopic: HomeTopicDetail | null) {
  const validIds = new Set((nextTopic?.items ?? []).filter(item => item.ownedRecipeId).map(item => item.id));
  queuedIds.value = queuedIds.value.filter(itemId => validIds.has(itemId));
  if (!queuedIds.value.length) {
    closePlanSheet();
  }
}

async function loadTopic(nextId = topicId.value, resetScroll = true) {
  loading.value = true;
  try {
    if (nextId > 0) {
      const result = await homeApi.getTopic(nextId);
      topic.value = result.topic;
      topicId.value = result.topic.id;
    } else {
      const result = await homeApi.getCurrentTopic();
      topic.value = result.topic;
      topicId.value = result.topic?.id ?? 0;
    }
    syncQueuedItems(topic.value);
    errorText.value = "";
    if (resetScroll) {
      jumpTop();
    }
  } catch (error) {
    topic.value = null;
    syncQueuedItems(null);
    errorText.value = error instanceof Error ? error.message : "加载本周灵感失败";
  } finally {
    loading.value = false;
  }
}

function jumpTop() {
  scrollAnchor.value = "topic-top";
  setTimeout(() => {
    scrollAnchor.value = "";
  }, 0);
}

function reload() {
  void loadTopic();
}

function handleTopicScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openRecipe(recipeId: number, refreshOnShow = true) {
  shouldRefreshOnShow.value = refreshOnShow;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=inspiration`);
}

function openHistory(nextId: number) {
  if (nextId === topicId.value) return;
  topicId.value = nextId;
  void loadTopic(nextId);
}

function handleRecipeAction(item: HomeTopicDetail["items"][number]) {
  if (!item.ownedRecipeId) {
    openAddSheet(item);
    return;
  }
  if (isQueued(item)) {
    queuedIds.value = queuedIds.value.filter(itemId => itemId !== item.id);
    if (!queuedIds.value.length) {
      closePlanSheet();
    }
    return;
  }
  queuedIds.value = [...queuedIds.value, item.id];
}

function openLogin(afterLogin?: () => void) {
  loginModalStore.open(null, afterLogin);
}

function openAddSheet(item: HomeTopicDetail["items"][number]) {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openAddSheet(item);
    });
    return;
  }
  currentAddItemId.value = item.id;
  addSheetVisible.value = true;
}

function closeAddSheet() {
  addSheetVisible.value = false;
  currentAddItemId.value = null;
}

async function collectIntoScenes(item: HomeTopicDetail["items"][number], sceneIds: UUID[]) {
  if (!sceneIds.length) return;
  await recipeApi.collectRecipe({
    operationId: createOperationId(),
    sourceRecipeId: item.id,
    sourceVersionId: item.sourceVersionId,
    sceneIds
  });
}

function syncOwnedRecipe(itemId: number, ownedRecipeId: number) {
  if (!topic.value) return;
  topic.value = {
    ...topic.value,
    items: topic.value.items.map(item => (item.id === itemId ? { ...item, ownedRecipeId } : item))
  };
}

async function confirmAddSheet(payload: { categoryId: UUID | ""; sceneIds: UUID[] }) {
  const item = currentAddItem.value;
  if (!item || !payload.categoryId || addSheetSubmitting.value) return;
  addSheetSubmitting.value = true;
  try {
    const sceneIds = [...payload.sceneIds];
    if (sceneIds.length) {
      await collectIntoScenes(item, sceneIds);
      markRecipeHomeDirty(["collection"]);
    }
    const result = await recipeApi.createMyRecipeFromInspiration({
      operationId: createOperationId(),
      sourceRecipeId: item.id,
      sourceVersionId: item.sourceVersionId,
      categoryId: payload.categoryId,
      sceneIds
    });
    syncOwnedRecipe(item.id, result.recipe.id);
    if (!queuedIds.value.includes(item.id)) {
      queuedIds.value = [...queuedIds.value, item.id];
    }
    markRecipeHomeDirty(["my"]);
    markRecipeManageDirty(["recipes"]);
    closeAddSheet();
    await uniPlatform.feedback.toast({ title: "已添加到我的，并加入待安排", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加失败", icon: "none" });
  } finally {
    addSheetSubmitting.value = false;
  }
}

function openPlanSheet() {
  if (!queuedItems.value.length) return;
  planDate.value = todayText();
  planMonth.value = buildMonthAnchor(planDate.value);
  mealSlot.value = "DINNER";
  sheetMounted.value = true;
  sheetVisible.value = false;
  void nextTick(() => {
    sheetVisible.value = true;
  });
  void loadPlanMarks(planMonth.value);
}

function closePlanSheet() {
  sheetVisible.value = false;
}

function handleSheetAfterClose() {
  sheetMounted.value = false;
}

function handlePlanMonthChange(nextMonthDate: string) {
  const nextMonth = buildMonthAnchor(nextMonthDate);
  if (nextMonth === planMonth.value) return;
  planMonth.value = nextMonth;
  void loadPlanMarks(nextMonth);
}

async function submitPlan(payload: { planDate: string; mealSlot: MealSlot }) {
  const recipeIds = queuedItems.value.map(item => item.ownedRecipeId).filter((item): item is UUID => Boolean(item));
  if (!recipeIds.length || planSubmitting.value) return;
  planSubmitting.value = true;
  try {
    const plans = await commonMealApi.listPlans({ from: payload.planDate, to: payload.planDate, page: 1, pageSize: 10 });
    const currentPlan = plans.items.find(item => item.mealSlot === payload.mealSlot) ?? null;
    const existingItems = currentPlan?.menuItems ?? [];
    const targetRecipeIds = [...existingItems.map(item => item.recipeId), ...recipeIds].filter(
      (item, index, list): item is UUID => Boolean(item) && list.indexOf(item) === index
    );
    const recipes = await Promise.all(targetRecipeIds.map(recipeId => recipeApi.getMyRecipe(recipeId)));
    const recipeMap = new Map(recipes.map(recipe => [recipe.id, recipe]));
    const menuItems = targetRecipeIds
      .map((recipeId, index) => {
        const recipe = recipeMap.get(recipeId);
        if (!recipe) return null;
        const existing = existingItems.find(item => item.recipeId === recipeId) ?? null;
        return {
          slotType: existing?.slotType ?? null,
          sortOrder: index,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: existing?.purchaseState ?? "READY"
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (menuItems.length !== targetRecipeIds.length) {
      await uniPlatform.feedback.toast({ title: "当前计划或待安排菜谱已变化，请刷新后重试", icon: "none" });
      return;
    }
    await commonMealApi.createPlan({
      operationId: createOperationId(),
      planDate: payload.planDate,
      mealSlot: payload.mealSlot,
      expectedVersion: currentPlan?.version ?? null,
      menuItems
    });
    queuedIds.value = [];
    closePlanSheet();
    await uniPlatform.feedback.toast({ title: "已加入计划", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "安排失败", icon: "none" });
  } finally {
    planSubmitting.value = false;
  }
}

async function loadPlanMarks(monthDate = planMonth.value) {
  const seq = ++planMarksSeq.value;
  try {
    const monthStart = parseDateOnly(monthDate);
    const rangeEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 12, 0, 0, 0);
    const items = await commonMealApi.listAllPlans({
      from: formatDateOnly(monthStart),
      to: formatDateOnly(rangeEnd)
    });
    if (seq !== planMarksSeq.value) return;
    const marks: Record<string, MealCalendarMark> = {};
    for (const item of items) {
      const current = marks[item.planDate] ?? createEmptyMealCalendarMark();
      appendMealSlotToMark(current, item.mealSlot);
      marks[item.planDate] = current;
    }
    planMarks.value = marks;
  } catch {
    if (seq === planMarksSeq.value) {
      planMarks.value = {};
    }
  }
}

function buildMonthAnchor(dateText: string) {
  const date = parseDateOnly(dateText);
  return formatDateOnly(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0));
}
</script>

<style scoped lang="scss">
.topic-scroll {
  height: 100%;
}

.topic-scroll {
  background: var(--color-page);
}

.topic-nav-backdrop {
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

.topic-nav-title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease, transform 180ms ease;
}

.topic-body {
  position: relative;
  min-height: 100%;
}

.topic-state {
  margin: 24rpx;
  padding: 28rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 26rpx;
  text-align: center;
}

.topic-state--error {
  color: var(--color-primary);
}

.topic-empty {
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding-right: var(--space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.topic-empty :deep(.empty-state) {
  width: 100%;
  border-radius: var(--radius-xs);
  box-shadow: 0 14rpx 36rpx var(--color-surface-mask-weak);
}

.topic-backdrop {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 760rpx;
  overflow: hidden;
}

.topic-backdrop__image,
.topic-backdrop__blur,
.topic-backdrop__veil {
  position: absolute;
  inset: 0;
}

.topic-backdrop__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--color-primary-soft) 0%, var(--color-page) 100%);
}

.topic-backdrop__empty-text {
  color: var(--color-text-secondary);
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
}

.topic-backdrop__blur {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(28rpx);
  transform: scale(1.08);
}

.topic-backdrop__veil {
  opacity: 0.8;
  background:
    linear-gradient(180deg, var(--color-surface-mask-medium) 0%, var(--color-surface-mask-strong) 58%, var(--color-page) 100%);
    backdrop-filter: saturate(180%) blur(22rpx);
}

.topic-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.topic-summary {
  display: flex;
  gap: 30rpx;
  padding: 0 var(--space-page);
}

.topic-summary__cover {
  width: 200rpx;
  height: 200rpx;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: 0 8rpx 20rpx var(--color-surface-mask-medium);
}

.topic-summary__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.topic-summary__cover-text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: 700;
}

.topic-summary__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14rpx;
  min-width: 0;
}

.topic-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.topic-chip {
  padding: 8rpx 16rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: 600;
}

.topic-chip--soft {
  background: var(--color-surface-mask-strong);
  color: var(--color-text-secondary);
}

.topic-summary__title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.24;
}

.topic-summary__sub {
  color: var(--color-text-secondary);
  font-size: 25rpx;
  line-height: 1.5;
}

.topic-summary__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.topic-summary__stat {
  color: var(--color-text-secondary);
  font-size: 23rpx;
}

.topic-intro {
  display: flex;
  flex-direction: column;
  padding: 20rpx var(--space-page);
}

.topic-intro__desc {
  color: var(--color-text);
  font-size: 26rpx;
  line-height: 1.8;
}

.topic-section {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 20rpx var(--space-page) 0;
  overflow: hidden;
  background: var(--color-page);
  isolation: isolate;
}

.topic-section::before,
.topic-section::after {
  content: "";
  position: absolute;
  top: 96rpx;
  width: 360rpx;
  height: 520rpx;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(24rpx);
  z-index: 0;
}

.topic-section::before {
  left: -168rpx;
  opacity: 0.92;
  background:
    radial-gradient(circle at 68% 14%, var(--color-primary-soft) 0%, transparent 34%),
    radial-gradient(circle at 22% 34%, var(--color-primary-soft) 0%, transparent 38%),
    radial-gradient(circle at 60% 58%, var(--color-primary-soft) 0%, transparent 36%),
    radial-gradient(circle at 28% 84%, var(--color-primary-soft) 0%, transparent 32%);
}

.topic-section::after {
  right: -176rpx;
  top: 188rpx;
  opacity: 0.84;
  background:
    radial-gradient(circle at 34% 12%, var(--color-primary-soft) 0%, transparent 34%),
    radial-gradient(circle at 76% 36%, var(--color-primary-soft) 0%, transparent 38%),
    radial-gradient(circle at 36% 62%, var(--color-primary-soft) 0%, transparent 36%),
    radial-gradient(circle at 70% 86%, var(--color-primary-soft) 0%, transparent 34%);
}

.topic-section > .topic-section__head,
.topic-section > .recipe-list,
.topic-section > .history-scroll {
  position: relative;
  z-index: 1;
}

.topic-section + .topic-section {
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom))
}

.topic-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0 40rpx;
}

.topic-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 700;
}

.topic-section__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 80rpx;
}

.recipe-card {
  width: calc(100% - 36rpx);
  padding-bottom: 40rpx;
  transition: transform 0.18s ease;
}

.recipe-card--reverse {
  align-self: flex-end;
}

.recipe-card--hover {
  transform: translateY(-2rpx);
}

.recipe-card__layout {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.recipe-card--reverse .recipe-card__layout {
  flex-direction: row-reverse;
}

.recipe-card__rail {
  width: 184rpx;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18rpx;
  color: var(--color-text);
}

.recipe-card__part {
  letter-spacing: 4rpx;
  font-size: 18rpx;
  line-height: 1;
}

.recipe-card__sort {
  margin-top: 10rpx;
  font-size: 56rpx;
  font-weight: 500;
  line-height: 1;
}

.recipe-card__meta-group {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 18rpx;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.recipe-card__meta-pill {
  padding: 0;
  color: var(--color-text-secondary);
  font-size: 18rpx;
  line-height: 1.4;
  text-align: center;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 4rpx;
}

.recipe-card__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recipe-card__cover {
  width: 100%;
  height: 400rpx;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface-muted);
  box-shadow: 0 18rpx 38rpx var(--color-surface-mask-weak);
}

.recipe-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-card__cover-text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.recipe-card__title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 50rpx;
}

.recipe-card__footer {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.recipe-card__title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.recipe-card__note {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 50rpx;
  padding: 0 10rpx;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.recipe-card__action-icon {
  font-size: 26rpx;
  line-height: 1;
}

.recipe-card__action--guide {
  color: var(--color-text-secondary);
}

.recipe-card__action--ready {
  color: var(--color-text-secondary);
}

.recipe-card__action--queued {
  color: var(--color-primary);
}

.recipe-note {
  margin-top: 44rpx;
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 8rpx 0 0;
}

.recipe-note__icon {
  flex: 0 0 auto;
  margin-top: 8rpx;
  color: var(--color-primary);
  opacity: 0.54;
  font-size: 22rpx;
  line-height: 1;
}

.recipe-note__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.recipe-note__line {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.recipe-note__line--soft {
  color: var(--color-text-tertiary);
}

.history-scroll {
  margin-right: -24rpx;
}

.history-row {
  display: flex;
  gap: var(--space-page);
}

.history-card {
  position: relative;
  width: 540rpx;
  height: 300rpx;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  transition: transform 0.18s ease;
}

.history-card--hover {
  transform: translateY(-2rpx);
}

.history-card__cover {
  width: 100%;
  height: 300rpx;
  background: var(--color-surface-muted);
}

.history-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-card__cover-text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
}

.history-card__issue {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  font-size: 0;
  border-radius: 0 0 0 var(--radius-xs);
  background: var(--color-surface-mask-strong);
  padding: 8rpx 16rpx;
}

.history-card__issue-text {
  color: var(--color-text);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.history-card__mask {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 90rpx;
  background: linear-gradient(180deg, transparent 0%, var(--color-surface-mask-weak) 30%, var(--color-surface-mask-medium) 50%,  var(--color-surface-mask-strong) 100%);
}

.history-card__title {
  position: absolute;
  right: 20rpx;
  bottom: 18rpx;
  left: 20rpx;
  overflow: hidden;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-note {
  padding: 28rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
}

.panel-note--sheet {
  margin-bottom: 12rpx;
}

.add-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-bottom: 12rpx;
}

.add-sheet__card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: 0 12rpx 30rpx var(--color-surface-mask-weak);
}

.add-sheet__cover {
  width: 144rpx;
  height: 112rpx;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface-muted);
}

.add-sheet__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-sheet__cover-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.add-sheet__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.add-sheet__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.45;
}

.add-sheet__meta {
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.5;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 700;
}

.sheet-section__tag {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.sheet-section__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}

.sheet-section__hint {
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
}

.sheet-creator {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.sheet-creator__input {
  flex: 1;
  min-width: 0;
  height: 84rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 26rpx;
}

.sheet-creator__button {
  flex: 0 0 auto;
  height: 84rpx;
  padding: 0 28rpx;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 84rpx;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.chip--active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.plan-queue {
  position: fixed;
  right: 28rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 14rpx;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.plan-queue--hover {
  opacity: 0.92;
}

.plan-queue__icon {
  line-height: 1;
  color: currentColor;
}

.plan-queue__label {
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1;
}

.plan-queue__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 10rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.22);
}

.plan-queue__badge-text {
  color: currentColor;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
}

</style>
