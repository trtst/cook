<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="做饭助手" full-screen>
    <Empty
      v-if="!sessionStore.isLoggedIn"
      :art="emptyStateArt"
      title="登录后查看做饭建议"
      description="这桌菜的准备顺序、开做节奏和上桌安排，都需要登录后继续处理。"
      clickable
      @click="openLogin"
    />

    <view v-else class="assistant-page">
      <view class="assistant-banner assistant-banner--activity">
        <text class="assistant-banner__title">{{ tipsText }}</text>
      </view>
      <view v-if="loading && !planDetail" class="assistant-state">加载中...</view>
      <view v-else-if="errorText && !planDetail" class="assistant-state assistant-state--error" @click="loadDetail">
        {{ errorText }}
      </view>
      <view v-else-if="!planDetail" class="assistant-empty">
        <Empty title="未找到这顿饭" description="可能已被删除，或当前访问路径不正确。" />
      </view>

      <scroll-view v-else scroll-y class="assistant-scroll" :show-scrollbar="false">
        <view class="assistant-body">
          <view class="assistant-hero">
            <text class="assistant-hero__eyebrow">{{ heroEyebrow }}</text>
            <text class="assistant-hero__title">{{ heroTitle }}</text>
            <text class="assistant-hero__meta">{{ heroMeta }}</text>
          </view>

          <view class="assistant-summary-card">
            <view class="assistant-summary-card__fact">
              <text class="assistant-summary-card__label">菜单</text>
              <text class="assistant-summary-card__value">{{ currentMenuItems.length }}道菜</text>
            </view>
            <view class="assistant-summary-card__fact">
              <text class="assistant-summary-card__label">状态</text>
              <text class="assistant-summary-card__value">{{ assistantStatusText }}</text>
            </view>
          </view>

          <view v-if="currentMenuItems.length" class="assistant-menu">
            <text class="assistant-section__title">这桌吃什么</text>
            <view v-for="item in currentMenuItems" :key="item.key" class="assistant-menu__item">
              <text class="assistant-menu__name">{{ item.title }}</text>
              <text v-if="item.meta" class="assistant-menu__meta">{{ item.meta }}</text>
            </view>
          </view>

          <view v-if="!currentMenuItems.length" class="assistant-panel assistant-panel--empty">
            <text class="assistant-panel__title">先把菜单定下来</text>
            <text class="assistant-panel__text">做饭助手会按这顿饭的菜单，整理准备顺序、开做节奏和上桌安排。</text>
          </view>

          <template v-else>
            <view v-if="thinking" class="assistant-panel assistant-panel--loading">
              <text class="assistant-panel__title">正在思考这桌菜</text>
              <text class="assistant-panel__text">我会把多道菜整理成准备、烹饪、上桌三个阶段。</text>
            </view>

            <view v-else-if="cookAssistantLoading && cookAssistant?.status !== 'READY'" class="assistant-panel assistant-panel--loading">
              <text class="assistant-panel__title">正在整理这桌菜</text>
              <text class="assistant-panel__text">准备顺序、开做节奏和上桌安排正在生成中。</text>
            </view>

            <view v-else-if="cookAssistantError" class="assistant-panel assistant-panel--error">
              <text class="assistant-panel__title">做饭助手加载失败</text>
              <text class="assistant-panel__text">{{ cookAssistantError }}</text>
              <button class="assistant-actions__button assistant-actions__button--primary" @click="retryCookAssistant">重试</button>
            </view>

            <view v-else-if="hasAssistantBody" class="assistant-panel">
              <view class="assistant-grid">
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">前期准备</text>
                  <text class="assistant-grid__value">{{ prepSteps.length }}项</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">开做步骤</text>
                  <text class="assistant-grid__value">{{ cookSteps.length }}步</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">收尾上桌</text>
                  <text class="assistant-grid__value">{{ serveSteps.length }}项</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">生成时间</text>
                  <text class="assistant-grid__value">{{ cookAssistant?.generatedAt ? formatDateTimeMinute(cookAssistant.generatedAt) : "待生成" }}</text>
                </view>
              </view>

              <text v-if="assistantSummary" class="assistant-panel__text">{{ assistantSummary }}</text>

              <view v-if="prepSteps.length" class="assistant-section">
                <text class="assistant-section__title">前期准备</text>
                <view v-for="item in prepSteps" :key="`prep-${item.order}`" class="assistant-step">
                  <text class="assistant-step__title">{{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text class="assistant-step__dish">{{ stepDishText(item) }} · {{ item.source === "ORIGINAL" ? "原始步骤" : "Wiki步骤" }}</text>
                </view>
              </view>

              <view v-if="cookSteps.length" class="assistant-section">
                <text class="assistant-section__title">开做顺序</text>
                <view v-for="item in cookSteps" :key="`timeline-${item.order}`" class="assistant-step">
                  <text class="assistant-step__title">步骤 {{ item.order }} · {{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text class="assistant-step__dish">{{ stepDishText(item) }} · {{ item.source === "ORIGINAL" ? "原始步骤" : "Wiki步骤" }}</text>
                </view>
              </view>

              <view v-if="serveSteps.length" class="assistant-section">
                <text class="assistant-section__title">收尾上桌</text>
                <view v-for="item in serveSteps" :key="`serve-${item.order}`" class="assistant-step">
                  <text class="assistant-step__title">{{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text class="assistant-step__dish">{{ stepDishText(item) }} · {{ item.source === "ORIGINAL" ? "原始步骤" : "Wiki步骤" }}</text>
                </view>
              </view>

              <view v-if="assistantNotes.length" class="assistant-section">
                <text class="assistant-section__title">提醒</text>
                <view v-for="(item, index) in assistantNotes" :key="`note-${index}`" class="assistant-note">
                  {{ item }}
                </view>
              </view>
            </view>

            <view v-else class="assistant-panel assistant-panel--empty">
              <text class="assistant-panel__title">先整理这桌菜，再开始做饭</text>
              <text class="assistant-panel__text">做饭助手会按这顿饭的菜单，帮你整理准备顺序、开做节奏和上桌安排。</text>
            </view>

            <view class="assistant-actions">
              <button
                v-if="!hasAssistantBody"
                class="assistant-actions__button assistant-actions__button--primary"
                :class="{ 'assistant-actions__button--disabled': submitting || (!canUnlock && cookAssistant?.status === 'READY') }"
                @click="handleUnlockCookAssistant"
              >
                {{ actionLabel }}
              </button>
              <button
                v-else
                class="assistant-actions__button assistant-actions__button--primary"
                @click="openCookMode"
              >
                进入炊火智厨
              </button>
              <text v-if="!hasAssistantBody" class="assistant-actions__link" @click="openCookMode">按菜谱做饭</text>
            </view>
          </template>
        </view>
      </scroll-view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { ApiClientError, UnauthorizedError, type UUID } from "@/apis/http";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { useLoginEmptyState } from "@/composables/useLoginEmptyState";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useAppConfigStore } from "@/stores/app-config";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";
import { createOperationId } from "@/utils/operation-id";
import { userApi, type CookAssistantUsageResponse } from "@/apis/user";
import {
  mealApi,
  type DiningEventSummary,
  type MealCookAssistantStep,
  type MealCookContextResponse,
  type MealPlanCookAssistant
} from "../apis/meal";
import { formatDateTimeMinute } from "../utils/date";

type MenuEntry = {
  key: string;
  title: string;
  meta: string;
};

type MealAssistantPlan = {
  id: UUID;
  planDate: string;
  mealSlot: MealCookContextResponse["mealSlot"];
  menuItems: Array<{
    recipeVersionId: UUID;
    title: string;
    servings: number | null;
  }>;
};

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(() => void loadDetail());
const appConfigStore = useAppConfigStore();
const loading = ref(false);
const submitting = ref(false);
const thinking = ref(false);
const errorText = ref("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const eventId = ref<UUID | "">("");
const planDetail = ref<MealAssistantPlan | null>(null);
const eventDetail = ref<DiningEventSummary | null>(null);
const cookAssistantLoading = ref(false);
const cookAssistant = ref<MealPlanCookAssistant | null>(null);
const cookAssistantError = ref("");
const usage = ref<CookAssistantUsageResponse | null>(null);
let thinkingTimer: ReturnType<typeof setTimeout> | null = null;

const THINKING_MIN_MS = 900;
const THINKING_SPAN_MS = 900;

const currentMenuItems = computed<MenuEntry[]>(() => {
  if (eventDetail.value) {
    return eventDetail.value.menuItems.map(item => ({
      key: `event-${item.id}`,
      title: item.title,
      meta: "主家菜单"
    }));
  }
  return (planDetail.value?.menuItems ?? []).map(item => ({
    key: `plan-${item.recipeVersionId}`,
    title: item.title,
    meta: item.servings ? `${item.servings}人份` : ""
  }));
});

const heroEyebrow = computed(() => {
  if (!planDetail.value) return "";
  return `${formatPlanDate(planDetail.value.planDate)} · ${formatMealSlot(planDetail.value.mealSlot)}`;
});

const heroTitle = computed(() => {
  if (eventDetail.value) return eventDetail.value.title || "这桌菜的做饭建议";
  return "先把这桌菜整理好";
});

const heroMeta = computed(() => {
  if (!currentMenuItems.value.length) return "先把菜单定下来，后面生成做饭安排会基于这里继续。";
  if (cookAssistant.value?.status === "READY" && cookAssistant.value?.unlocked) {
    return "这份做饭建议会继续挂在这顿饭下面，后面再打开也能直接接着用。";
  }
  return "把准备顺序、开做节奏和上桌安排整理成一份可执行步骤。";
});

const assistantStatusText = computed(() => {
  if (thinking.value) return "思考中";
  if (cookAssistantError.value) return "加载失败";
  if (cookAssistantLoading.value && cookAssistant.value?.status !== "READY") return "生成中";
  if (!cookAssistant.value || cookAssistant.value.status === "NOT_GENERATED") return "未生成";
  if (cookAssistant.value.status === "GENERATING") return "生成中";
  if (cookAssistant.value.status === "FAILED") return "生成失败";
  if (!cookAssistant.value.unlocked) return "待解锁";
  return cookAssistant.value.generatedAt ? `最近生成于 ${formatDateTimeMinute(cookAssistant.value.generatedAt)}` : "已生成";
});

const tipsText = computed(() => appConfigStore.cookAssistant.tipText || "活动期间，免费生成，每天 2 次，当日有效");
const remainingCount = computed(() => usage.value?.remainingCount ?? 0);
const canUnlock = computed(() => Boolean((usage.value?.activityEnabled ?? appConfigStore.cookAssistant.activityEnabled) && remainingCount.value > 0));
const assistantSteps = computed(() => cookAssistant.value?.assistant?.steps ?? []);
const prepSteps = computed(() => assistantSteps.value.filter(item => item.phase === "PREP"));
const cookSteps = computed(() => assistantSteps.value.filter(item => item.phase === "COOK"));
const serveSteps = computed(() => assistantSteps.value.filter(item => item.phase === "SERVE"));
const assistantNotes = computed(() => cookAssistant.value?.assistant?.notes ?? []);
const assistantSummary = computed(() => cookAssistant.value?.assistant?.summary || "");
const hasAssistantBody = computed(() => Boolean(cookAssistant.value?.unlocked && cookAssistant.value.assistant?.steps.length));
const actionLabel = computed(() => {
  if (!currentMenuItems.value.length) return "按菜谱做饭";
  if (hasAssistantBody.value) return "进入炊火智厨";
  if (!canUnlock.value) return "次数不足";
  return cookAssistant.value?.status === "READY" ? "解锁查看" : "生成并解锁";
});

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
});

onShow(() => {
  void loadDetail();
});

onUnload(() => {
  clearThinkingTimer();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
      return;
    }
    void loadDetail();
  }
);

async function loadDetail() {
  if (!sessionStore.isLoggedIn || !planItemId.value || loading.value) return;

  loading.value = true;
  errorText.value = "";
  try {
    const context = await mealApi.getCookContext(planItemId.value);
    const nextPlan = toMealAssistantPlan(context);
    planDetail.value = nextPlan;
    planDate.value = context.planDate;

    if (!appConfigStore.loaded) {
      await appConfigStore.load();
    }
    await loadCookAssistant(context.planItemId);
    const targetEventId = eventId.value || context.diningEventId;
    if (!targetEventId) {
      eventDetail.value = null;
      return;
    }
    try {
      eventDetail.value = await mealApi.getDiningEvent(targetEventId);
    } catch {
      eventDetail.value = null;
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      errorText.value = "";
      openLogin();
      return;
    }
    errorText.value = error instanceof Error ? error.message : "做饭助手加载失败，点此重试";
  } finally {
    loading.value = false;
  }
}

function toMealAssistantPlan(context: MealCookContextResponse): MealAssistantPlan {
  return {
    id: context.planItemId,
    planDate: context.planDate,
    mealSlot: context.mealSlot,
    menuItems: context.dishes.map(dish => ({
      recipeVersionId: dish.recipeVersionId,
      title: dish.title,
      servings: null
    }))
  };
}

async function loadCookAssistant(currentPlanItemId: UUID) {
  cookAssistantLoading.value = true;
  cookAssistantError.value = "";
  try {
    cookAssistant.value = await mealApi.getCookAssistant(currentPlanItemId);
    if (!cookAssistant.value.unlocked) {
      usage.value = await userApi.getCookAssistantUsage();
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    cookAssistant.value = null;
    cookAssistantError.value = error instanceof Error ? error.message : "暂时无法读取做饭助手，请稍后重试";
  } finally {
    cookAssistantLoading.value = false;
  }
}

function retryCookAssistant() {
  if (!planDetail.value) return;
  void loadCookAssistant(planDetail.value.id);
}

function clearPageState() {
  loading.value = false;
  submitting.value = false;
  errorText.value = "";
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantError.value = "";
  cookAssistantLoading.value = false;
  usage.value = null;
  thinking.value = false;
  clearThinkingTimer();
}

async function handleUnlockCookAssistant() {
  if (!planDetail.value || !currentMenuItems.value.length || cookAssistantLoading.value || submitting.value) return;
  if (cookAssistant.value?.status === "READY" && !canUnlock.value) {
    await uniPlatform.feedback.toast({ title: "今日次数已用完", icon: "none" });
    return;
  }
  cookAssistantLoading.value = true;
  submitting.value = true;
  try {
    const result = await mealApi.unlockCookAssistant(planDetail.value.id, {
      operationId: createOperationId()
    });
    if (result.newlyUnlocked) {
      await showThinking(result);
    } else {
      cookAssistant.value = result;
    }
    usage.value = await userApi.getCookAssistantUsage().catch(() => usage.value);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      openLogin();
      return;
    }
    const message = error instanceof ApiClientError && error.code === 429 ? "今日次数已用完" : error instanceof Error ? error.message : "解锁失败";
    await uniPlatform.feedback.toast({ title: message, icon: "none" });
  } finally {
    cookAssistantLoading.value = false;
    submitting.value = false;
  }
}

function showThinking(result: MealPlanCookAssistant & { newlyUnlocked?: boolean }) {
  clearThinkingTimer();
  thinking.value = true;
  const delayMs = THINKING_MIN_MS + Math.floor(Math.random() * THINKING_SPAN_MS);
  return new Promise<void>((resolve) => {
    thinkingTimer = setTimeout(() => {
      cookAssistant.value = result;
      thinking.value = false;
      thinkingTimer = null;
      resolve();
    }, delayMs);
  });
}

function clearThinkingTimer() {
  if (!thinkingTimer) return;
  clearTimeout(thinkingTimer);
  thinkingTimer = null;
}

function openCookMode() {
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  const flowQuery = hasAssistantBody.value ? "&flow=assistant" : "&flow=original";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=plan&planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${flowQuery}${eventQuery}`
  );
}

function stepDishText(step: MealCookAssistantStep) {
  const dishTitles = cookAssistant.value?.assistant?.dishes
    .filter(item => step.dishIds.includes(item.dishId))
    .map(item => item.title)
    .filter(Boolean) ?? [];
  return dishTitles.length ? dishTitles.join("、") : "整桌";
}

function parseQueryId(value: unknown): UUID | "" {
  const raw = Array.isArray(value) ? value[0] : value;
  const decoded = typeof raw === "string" ? Number(decodeURIComponent(raw)) : Number(raw);
  return Number.isInteger(decoded) && decoded > 0 ? decoded : "";
}

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}

function formatPlanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "这一天";
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

async function automatorApplySession(snapshot: { token: string; uid: number; expiresAt: string }) {
  await sessionStore.setSession(snapshot);
  await loadDetail();
}

async function automatorReadState() {
  await nextTick();
  return {
    title: heroTitle.value,
    eyebrow: heroEyebrow.value,
    meta: heroMeta.value,
    menuCount: currentMenuItems.value.length,
    assistantStatusText: assistantStatusText.value,
    status: cookAssistant.value?.status ?? "NOT_GENERATED",
    unlocked: cookAssistant.value?.unlocked ?? false,
    generatedAt: cookAssistant.value?.generatedAt ?? null,
    prepTaskCount: prepSteps.value.length,
    timelineStepCount: cookSteps.value.length,
    serveTaskCount: serveSteps.value.length,
    noteTexts: assistantNotes.value,
    actionLabel: actionLabel.value,
    remainingCount: remainingCount.value,
    thinking: thinking.value
  };
}

async function automatorGenerateCookAssistant() {
  await handleUnlockCookAssistant();
  return automatorReadState();
}

defineExpose({
  automatorApplySession,
  automatorReadState,
  automatorGenerateCookAssistant
});
</script>

<style scoped lang="scss">
.assistant-page,
.assistant-scroll {
  height: 100%;
}

.assistant-page {
  display: flex;
  flex: 1;
  min-height: 0;
  background: var(--page-warm-bg);
}

.assistant-empty {
  display: flex;
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}

.assistant-empty :deep(.empty-state--art) {
  width: 100%;
  margin-top: 0;
}

.assistant-state {
  padding: 56rpx var(--space-page);
  color: var(--color-text-secondary);
}

.assistant-state--error {
  color: var(--color-state-danger-text);
}

.assistant-body {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 24rpx var(--space-page) calc(44rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.assistant-hero,
.assistant-summary-card,
.assistant-menu,
.assistant-panel {
  border-radius: 28rpx;
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-card);
}

.assistant-hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx 28rpx;
}

.assistant-hero__eyebrow {
  font-size: 24rpx;
  color: var(--color-support-action);
}

.assistant-hero__title {
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.assistant-hero__meta {
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.assistant-summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
  padding: 24rpx 28rpx;
}

.assistant-summary-card__fact {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.assistant-summary-card__label {
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.assistant-summary-card__value {
  font-size: 28rpx;
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.assistant-menu,
.assistant-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 28rpx;
}

.assistant-menu__item {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid var(--color-border-light);
}

.assistant-menu__item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.assistant-menu__name {
  flex: 1;
  font-size: 28rpx;
  color: var(--color-text);
}

.assistant-menu__meta {
  font-size: 24rpx;
  color: var(--color-text-tertiary);
}

.assistant-section__title {
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.assistant-banner {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx 28rpx;
  border-radius: 28rpx;
  background: var(--color-state-warning-soft);
  box-shadow: none;
}

.assistant-banner__title {
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-state-warning-text);
}

.assistant-banner__text,
.assistant-panel__text {
  font-size: 26rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.assistant-panel__title {
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.assistant-panel--loading,
.assistant-panel--empty {
  justify-content: center;
  min-height: 220rpx;
}

.assistant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.assistant-grid__item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: var(--color-support-notice);
}

.assistant-grid__label {
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.assistant-grid__value {
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.assistant-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.assistant-step {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: 22rpx;
  background: var(--color-surface-primary-panel-soft);
}

.assistant-step__title {
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.assistant-step__text,
.assistant-step__dish,
.assistant-note {
  font-size: 25rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.assistant-step__dish {
  color: var(--color-support-action);
}

.assistant-note {
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: var(--color-support-notice);
}

.assistant-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.assistant-actions__button {
  flex: 1 1 auto;
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
}

.assistant-actions__button::after {
  border: none;
}

.assistant-actions__button--primary {
  color: var(--color-text-inverse);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.assistant-actions__link {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
