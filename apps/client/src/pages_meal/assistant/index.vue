<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="做饭助手" full-screen>
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看做饭建议"
      description="这桌菜的准备顺序、开做节奏和上桌安排，都需要登录后继续处理。"
    />

    <view v-else class="assistant-page">
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
            <view v-if="cookAssistant?.isStale" class="assistant-banner">
              <text class="assistant-banner__title">当前建议已过期</text>
              <text class="assistant-banner__text">菜单或菜谱有变化，原来的做饭安排可能已经不准，建议重新生成后再开始做饭。</text>
            </view>

            <view v-if="cookAssistantLoading && !cookAssistant?.hasSnapshot" class="assistant-panel assistant-panel--loading">
              <text class="assistant-panel__title">正在整理这桌菜</text>
              <text class="assistant-panel__text">准备顺序、开做节奏和上桌安排正在生成中。</text>
            </view>

            <view v-else-if="cookAssistant?.hasSnapshot" class="assistant-panel">
              <view class="assistant-grid">
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">前期准备</text>
                  <text class="assistant-grid__value">{{ cookAssistant.summary.prepTaskCount }}项</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">开做步骤</text>
                  <text class="assistant-grid__value">{{ cookAssistant.summary.timelineStepCount }}步</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">预计总时长</text>
                  <text class="assistant-grid__value">{{ cookAssistant.summary.totalDurationText || "待估算" }}</text>
                </view>
                <view class="assistant-grid__item">
                  <text class="assistant-grid__label">建议开做</text>
                  <text class="assistant-grid__value">{{ cookAssistant.summary.suggestedStartTime || "按这顿饭时间倒推" }}</text>
                </view>
              </view>

              <view v-if="cookAssistant.prepTasks.length" class="assistant-section">
                <text class="assistant-section__title">前期准备</text>
                <view v-for="(item, index) in cookAssistant.prepTasks" :key="`prep-${index}`" class="assistant-step">
                  <text class="assistant-step__title">{{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text v-if="item.dishTitles.length" class="assistant-step__dish">{{ item.dishTitles.join("、") }}</text>
                </view>
              </view>

              <view v-if="cookAssistant.cookTimeline.length" class="assistant-section">
                <text class="assistant-section__title">开做顺序</text>
                <view v-for="item in cookAssistant.cookTimeline" :key="`timeline-${item.order}`" class="assistant-step">
                  <text class="assistant-step__title">步骤 {{ item.order }} · {{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text v-if="item.dishTitles.length" class="assistant-step__dish">{{ item.dishTitles.join("、") }}</text>
                </view>
              </view>

              <view v-if="cookAssistant.serveTasks.length" class="assistant-section">
                <text class="assistant-section__title">收尾上桌</text>
                <view v-for="(item, index) in cookAssistant.serveTasks" :key="`serve-${index}`" class="assistant-step">
                  <text class="assistant-step__title">{{ item.title }}</text>
                  <text class="assistant-step__text">{{ item.detail }}</text>
                  <text v-if="item.dishTitles.length" class="assistant-step__dish">{{ item.dishTitles.join("、") }}</text>
                </view>
              </view>

              <view v-if="cookAssistant.summary.notes.length" class="assistant-section">
                <text class="assistant-section__title">提醒</text>
                <view v-for="(item, index) in cookAssistant.summary.notes" :key="`note-${index}`" class="assistant-note">
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
                v-if="!cookAssistant?.hasSnapshot || cookAssistant?.isStale"
                class="assistant-actions__button assistant-actions__button--primary"
                :disabled="cookAssistantLoading || submitting"
                @click="handleGenerateCookAssistant"
              >
                {{ cookAssistant?.isStale ? "重新生成建议" : "生成做饭建议" }}
              </button>
              <button
                v-else
                class="assistant-actions__button assistant-actions__button--primary"
                @click="openCookMode"
              >
                按建议开始做饭
              </button>
              <button class="assistant-actions__button assistant-actions__button--ghost" @click="openCookMode">
                {{ cookAssistant?.hasSnapshot && !cookAssistant?.isStale ? "开始做饭" : "直接开始做饭" }}
              </button>
            </view>
          </template>
        </view>
      </scroll-view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";
import { createOperationId } from "@/utils/operation-id";
import { mealApi, type DiningEventSummary, type MealPlanCookAssistant, type MealPlanSummary } from "../apis/meal";
import { formatDateTimeMinute } from "../utils/date";

type MenuEntry = {
  key: string;
  title: string;
  meta: string;
};

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const eventId = ref<UUID | "">("");
const planDetail = ref<MealPlanSummary | null>(null);
const eventDetail = ref<DiningEventSummary | null>(null);
const cookAssistantLoading = ref(false);
const cookAssistant = ref<MealPlanCookAssistant | null>(null);

const currentMenuItems = computed<MenuEntry[]>(() => {
  if (eventDetail.value) {
    return eventDetail.value.menuItems.map(item => ({
      key: `event-${item.id}`,
      title: item.title,
      meta: item.cookName?.trim() ? `${item.cookName.trim()} 来做` : "待认领"
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
  if (cookAssistant.value?.hasSnapshot && !cookAssistant.value.isStale) {
    return "这份做饭建议会继续挂在这顿饭下面，后面再打开也能直接接着用。";
  }
  return "把准备顺序、开做节奏和上桌安排整理成一份可执行步骤。";
});

const assistantStatusText = computed(() => {
  if (cookAssistantLoading.value && !cookAssistant.value?.hasSnapshot) return "生成中";
  if (!cookAssistant.value?.hasSnapshot) return "未生成";
  if (cookAssistant.value.isStale) return "已过期";
  return cookAssistant.value.generatedAt ? `最近生成于 ${formatDateTimeMinute(cookAssistant.value.generatedAt)}` : "已生成";
});

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
});

onShow(() => {
  void loadDetail();
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
  if (!sessionStore.isLoggedIn || !planItemId.value || !planDate.value || loading.value) return;

  loading.value = true;
  errorText.value = "";
  try {
    const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const nextPlan = result.items.find(item => item.id === planItemId.value) ?? null;
    planDetail.value = nextPlan;
    if (!nextPlan) {
      errorText.value = "这顿饭暂时找不到了，点此重试";
      eventDetail.value = null;
      cookAssistant.value = null;
      return;
    }

    await loadCookAssistant(nextPlan.id);
    const targetEventId = eventId.value || nextPlan.diningEventId;
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
    errorText.value = error instanceof Error ? error.message : "做饭助手加载失败，点此重试";
  } finally {
    loading.value = false;
  }
}

async function loadCookAssistant(currentPlanItemId: UUID) {
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.getCookAssistant(currentPlanItemId);
  } catch {
    cookAssistant.value = null;
  } finally {
    cookAssistantLoading.value = false;
  }
}

function clearPageState() {
  loading.value = false;
  submitting.value = false;
  errorText.value = "";
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantLoading.value = false;
}

async function handleGenerateCookAssistant() {
  if (!planDetail.value || !currentMenuItems.value.length || cookAssistantLoading.value || submitting.value) return;
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.generateCookAssistant(planDetail.value.id, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: cookAssistant.value.isStale ? "已重新生成" : "已生成做饭建议", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "生成失败", icon: "none" });
  } finally {
    cookAssistantLoading.value = false;
  }
}

function openCookMode() {
  if (!planDetail.value || !planDate.value || !currentMenuItems.value.length) return;
  const eventQuery = eventDetail.value?.id ? `&eventId=${encodeURIComponent(String(eventDetail.value.id))}` : "";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=plan&planItemId=${encodeURIComponent(String(planDetail.value.id))}&planDate=${encodeURIComponent(planDate.value)}${eventQuery}`
  );
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
  background: linear-gradient(180deg, #f8f4ea 0%, #f5efe2 20%, #f7f4ee 100%);
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
  color: var(--color-danger);
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
.assistant-panel,
.assistant-banner {
  border-radius: 28rpx;
  background: color-mix(in srgb, var(--color-surface) 92%, #fff 8%);
  box-shadow: 0 20rpx 44rpx color-mix(in srgb, #8a6b3d 10%, transparent);
}

.assistant-hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx 28rpx;
}

.assistant-hero__eyebrow {
  font-size: 24rpx;
  color: var(--color-primary);
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
  border-bottom: 1rpx solid color-mix(in srgb, var(--color-primary) 12%, transparent);
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
  background: color-mix(in srgb, #fff3dd 86%, var(--color-surface) 14%);
  box-shadow: none;
}

.assistant-banner__title {
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  color: #9a5f00;
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
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface) 93%);
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
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface) 95%);
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
  color: var(--color-primary);
}

.assistant-note {
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface) 94%);
}

.assistant-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.assistant-actions__button {
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
}

.assistant-actions__button::after {
  border: none;
}

.assistant-actions__button--primary {
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  box-shadow: var(--button-primary-shadow);
}

.assistant-actions__button--ghost {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 9%, var(--color-surface) 91%);
}
</style>
