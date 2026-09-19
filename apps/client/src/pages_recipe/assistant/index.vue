<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="做饭助手" full-screen>
    <Empty
      v-if="!sessionStore.isLoggedIn"
      :art="emptyStateArt"
      title="登录后查看做饭助手"
      description="登录后才能读取这道菜的做饭建议和解锁次数。"
      clickable
      @click="openLogin"
    />

    <view v-else class="assistant-page">
      <view class="assistant-tip">{{ tipsText }}</view>

      <view v-if="loading" class="assistant-state">加载中...</view>
      <view v-else-if="thinking" class="assistant-state assistant-state--thinking">
        <text class="assistant-state__title">正在思考这道菜的做饭节奏</text>
        <text class="assistant-state__desc">我会按准备、烹饪、上桌三个阶段整理步骤。</text>
      </view>
      <view v-else-if="unavailableText" class="assistant-state assistant-state--error">
        <text class="assistant-state__title">{{ unavailableText }}</text>
        <text class="assistant-state__desc">这道菜暂时只有按菜谱做饭的沉浸模式。</text>
        <button class="assistant-button assistant-button--ghost" @click="openCookMode">按菜谱做饭</button>
      </view>
      <view v-else-if="errorText" class="assistant-state assistant-state--error">
        <text class="assistant-state__title">{{ errorText }}</text>
        <button class="assistant-button assistant-button--ghost" @click="retryLoad">重试</button>
      </view>

      <scroll-view v-else scroll-y class="assistant-scroll" :show-scrollbar="false">
        <view class="assistant-body">
          <view class="assistant-hero">
            <text class="assistant-hero__eyebrow">单菜做饭助手</text>
            <text class="assistant-hero__title">{{ heroTitle }}</text>
            <text class="assistant-hero__meta">生成时间：{{ generatedAtText }}</text>
          </view>

          <view v-if="!assistantState?.unlocked" class="assistant-card assistant-card--locked">
            <text class="assistant-card__title">解锁这道菜的 Wiki 做饭步骤</text>
            <text class="assistant-card__text">{{ unlockHint }}</text>
            <button
              class="assistant-button"
              :class="{ 'assistant-button--disabled': !canUnlock || submitting }"
              @click="unlockAssistant"
            >
              {{ submitting ? "解锁中..." : "解锁查看" }}
            </button>
            <text class="assistant-card__link" @click="openCookMode">不解锁，按菜谱做饭</text>
          </view>

          <template v-else-if="hasAssistantBody">
            <view class="assistant-summary">
              <view class="assistant-summary__item">
                <text class="assistant-summary__value">{{ assistantState.assistant?.summary.prepStepCount || 0 }}</text>
                <text class="assistant-summary__label">准备</text>
              </view>
              <view class="assistant-summary__item">
                <text class="assistant-summary__value">{{ assistantState.assistant?.summary.cookStepCount || 0 }}</text>
                <text class="assistant-summary__label">烹饪</text>
              </view>
              <view class="assistant-summary__item">
                <text class="assistant-summary__value">{{ assistantState.assistant?.summary.serveStepCount || 0 }}</text>
                <text class="assistant-summary__label">上桌</text>
              </view>
            </view>

            <button class="assistant-button assistant-button--wide" @click="openCookMode">进入炊火智厨</button>

            <view v-for="phase in phaseSections" :key="phase.value" class="assistant-card">
              <text class="assistant-card__title">{{ phase.label }}</text>
              <view v-if="phase.steps.length" class="assistant-steps">
                <view v-for="step in phase.steps" :key="`${phase.value}-${step.order}`" class="assistant-step">
                  <ImageLoader v-if="step.imageUrl" class="assistant-step__image" :src="step.imageUrl" />
                  <text class="assistant-step__title">{{ step.order }}. {{ step.title }}</text>
                  <text class="assistant-step__detail">{{ step.detail }}</text>
                  <text v-if="step.durationText" class="assistant-step__duration">{{ step.durationText }}</text>
                </view>
              </view>
              <text v-else class="assistant-card__empty">这个阶段暂无步骤</text>
            </view>
          </template>
          <view v-else class="assistant-card assistant-card--locked">
            <text class="assistant-card__title">炊火智厨暂时没有可执行步骤</text>
            <text class="assistant-card__text">你仍然可以按原菜谱步骤开始做饭。</text>
            <button class="assistant-button assistant-button--ghost" @click="openCookMode">按菜谱做饭</button>
          </view>
        </view>
      </scroll-view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { ApiClientError, UnauthorizedError, type UUID } from "@/apis/http";
import {
  recipeApi,
  type RecipeAssistantStepPhase,
  type RecipeCookAssistantResponse
} from "@/apis/recipe";
import { userApi, type CookAssistantUsageResponse } from "@/apis/user";
import emptyStateArt from "@/assets/empty.png";
import Empty from "@/components/Empty/Empty.vue";
import ImageLoader from "@/components/ImageLoader.vue";
import Layout from "@/components/Layout/Layout.vue";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useLoginEmptyState } from "@/composables/useLoginEmptyState";
import { useTheme } from "@/composables/useTheme";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useAppConfigStore } from "@/stores/app-config";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

const THINKING_MIN_MS = 900;
const THINKING_SPAN_MS = 900;
const FALLBACK_TIP = "活动期间，免费生成，每天 2 次，当日有效";
const PHASE_LABELS: Record<RecipeAssistantStepPhase, string> = {
  PREP: "准备",
  COOK: "烹饪",
  SERVE: "上桌"
};

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));

const appConfigStore = useAppConfigStore();
const sessionStore = useSessionStore();
const { openLogin } = useLoginEmptyState(() => void loadPage());
const recipeVersionId = ref<UUID | "">("");
const recipeId = ref<UUID | "">("");
const recipeKind = ref<"my" | "inspiration">("my");
const assistantState = ref<RecipeCookAssistantResponse | null>(null);
const usage = ref<CookAssistantUsageResponse | null>(null);
const loading = ref(false);
const submitting = ref(false);
const thinking = ref(false);
const errorText = ref("");
const unavailableText = ref("");
let thinkingTimer: ReturnType<typeof setTimeout> | null = null;

const tipsText = computed(() => appConfigStore.cookAssistant.tipText || FALLBACK_TIP);
const activityEnabled = computed(() => usage.value?.activityEnabled ?? appConfigStore.cookAssistant.activityEnabled);
const remainingCount = computed(() => usage.value?.remainingCount ?? 0);
const canUnlock = computed(() => Boolean(activityEnabled.value && remainingCount.value > 0));
const hasAssistantBody = computed(() => Boolean(assistantState.value?.unlocked && assistantState.value.assistant?.steps.length));
const heroTitle = computed(() => (hasAssistantBody.value ? "按 Wiki 步骤做这道菜" : "解锁后查看完整步骤"));
const generatedAtText = computed(() => formatDateTime(assistantState.value?.generatedAt || ""));
const unlockHint = computed(() => {
  if (!activityEnabled.value) return "当前活动暂未开放，仍可使用按菜谱做饭。";
  if (remainingCount.value <= 0) return "今日免费次数已用完，明天可继续解锁。";
  return `今日还可解锁 ${remainingCount.value} 次。`;
});

const phaseSections = computed(() => {
  const steps = assistantState.value?.assistant?.steps ?? [];
  return (["PREP", "COOK", "SERVE"] as RecipeAssistantStepPhase[]).map(phase => ({
    value: phase,
    label: PHASE_LABELS[phase],
    steps: steps.filter(step => step.phase === phase).sort((left, right) => left.order - right.order)
  }));
});

onLoad((query) => {
  const id = Number(query?.recipeVersionId);
  recipeVersionId.value = Number.isInteger(id) && id > 0 ? id : "";
  const targetRecipeId = Number(query?.recipeId);
  recipeId.value = Number.isInteger(targetRecipeId) && targetRecipeId > 0 ? targetRecipeId : "";
  recipeKind.value = query?.kind === "inspiration" ? "inspiration" : "my";
  void loadPage();
});

onUnload(() => {
  clearThinkingTimer();
});

async function loadPage() {
  if (!sessionStore.isLoggedIn) return;
  if (!recipeVersionId.value) {
    unavailableText.value = "菜谱版本无效";
    return;
  }
  loading.value = true;
  errorText.value = "";
  unavailableText.value = "";
  try {
    if (!appConfigStore.loaded) {
      await appConfigStore.load();
    }
    const nextState = await recipeApi.getRecipeVersionCookAssistant(recipeVersionId.value);
    assistantState.value = nextState;
    if (!nextState.unlocked) {
      usage.value = await userApi.getCookAssistantUsage();
    }
  } catch (error) {
    handleAssistantError(error);
  } finally {
    loading.value = false;
  }
}

function retryLoad() {
  void loadPage();
}

async function unlockAssistant() {
  if (!recipeVersionId.value || !canUnlock.value || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    const result = await recipeApi.unlockRecipeVersionCookAssistant(recipeVersionId.value, {
      operationId: createOperationId()
    });
    if (result.newlyUnlocked) {
      await showThinking(result);
    } else {
      assistantState.value = result;
    }
    usage.value = await userApi.getCookAssistantUsage().catch(() => usage.value);
  } catch (error) {
    handleAssistantError(error);
  } finally {
    submitting.value = false;
  }
}

function showThinking(result: RecipeCookAssistantResponse) {
  clearThinkingTimer();
  thinking.value = true;
  const delayMs = THINKING_MIN_MS + Math.floor(Math.random() * THINKING_SPAN_MS);
  return new Promise<void>((resolve) => {
    thinkingTimer = setTimeout(() => {
      assistantState.value = result;
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

function handleAssistantError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    errorText.value = "";
    unavailableText.value = "";
    openLogin();
    return;
  }
  if (error instanceof ApiClientError && error.code === 409) {
    unavailableText.value = "做饭助手暂不可用";
    return;
  }
  if (error instanceof ApiClientError && error.code === 429) {
    errorText.value = "今日次数已用完";
    return;
  }
  errorText.value = error instanceof Error ? error.message : "加载失败，请重试";
}

function openCookMode() {
  if (!recipeId.value) {
    void uniPlatform.navigation.navigateBack();
    return;
  }
  const flowQuery = hasAssistantBody.value
    ? `&flow=assistant&recipeVersionId=${encodeURIComponent(String(recipeVersionId.value))}`
    : "&flow=original";
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/cook-mode/index?source=recipe&recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${encodeURIComponent(recipeKind.value)}${flowQuery}`
  );
}

function formatDateTime(value: string) {
  if (!value) return "待生成";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

function automatorReadState() {
  return {
    recipeVersionId: recipeVersionId.value,
    recipeId: recipeId.value,
    recipeKind: recipeKind.value,
    loading: loading.value,
    thinking: thinking.value,
    unlocked: assistantState.value?.unlocked ?? false,
    generatedAt: assistantState.value?.generatedAt ?? "",
    remainingCount: remainingCount.value,
    activityEnabled: activityEnabled.value,
    errorText: errorText.value,
    unavailableText: unavailableText.value,
    phaseCount: phaseSections.value.length,
    prepCount: phaseSections.value.find(item => item.value === "PREP")?.steps.length ?? 0,
    cookCount: phaseSections.value.find(item => item.value === "COOK")?.steps.length ?? 0,
    serveCount: phaseSections.value.find(item => item.value === "SERVE")?.steps.length ?? 0
  };
}

defineExpose({
  automatorReadState
});
</script>

<style scoped>
.assistant-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  color: var(--color-text-primary);
}

.assistant-tip {
  margin: 24rpx 24rpx 0;
  padding: 18rpx 22rpx;
  border-radius: 24rpx;
  background: var(--color-state-warning-soft);
  color: var(--color-state-warning-text);
  font-size: 24rpx;
  line-height: 1.5;
}

.assistant-scroll {
  height: calc(100vh - 92rpx);
}

.assistant-body {
  padding: 24rpx 24rpx max(56rpx, env(safe-area-inset-bottom));
}

.assistant-state {
  min-height: 56vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  padding: 48rpx;
  text-align: center;
  color: var(--color-text-secondary);
}

.assistant-state--thinking {
  color: var(--color-brand-primary);
}

.assistant-state--error {
  color: var(--color-text-primary);
}

.assistant-state__title {
  font-size: 32rpx;
  font-weight: 700;
}

.assistant-state__desc {
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.assistant-hero,
.assistant-card,
.assistant-summary {
  border-radius: 32rpx;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
}

.assistant-hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 32rpx;
}

.assistant-hero__eyebrow,
.assistant-hero__meta,
.assistant-card__text,
.assistant-card__empty,
.assistant-step__duration {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.assistant-hero__title {
  font-size: 40rpx;
  font-weight: 800;
}

.assistant-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.assistant-card--locked {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.assistant-card__title {
  font-size: 30rpx;
  font-weight: 700;
}

.assistant-card__text,
.assistant-card__empty {
  line-height: 1.6;
}

.assistant-card__link {
  text-align: center;
  color: var(--color-brand-primary);
  font-size: 26rpx;
}

.assistant-button {
  height: 88rpx;
  border-radius: 999rpx;
  background: var(--color-brand-primary);
  color: var(--button-primary-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 88rpx;
}

.assistant-button::after {
  border: 0;
}

.assistant-button--disabled {
  opacity: 0.45;
}

.assistant-button--ghost {
  min-width: 220rpx;
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
}

.assistant-button--wide {
  width: 100%;
  margin-top: 24rpx;
}

.assistant-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 24rpx;
}

.assistant-summary__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.assistant-summary__value {
  font-size: 36rpx;
  font-weight: 800;
}

.assistant-summary__label {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.assistant-steps {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 22rpx;
}

.assistant-step {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--color-bg-page);
}

.assistant-step__image {
  width: 100%;
  height: 320rpx;
  border-radius: 20rpx;
  overflow: hidden;
}

.assistant-step__title {
  font-size: 28rpx;
  font-weight: 700;
}

.assistant-step__detail {
  color: var(--color-text-primary);
  font-size: 26rpx;
  line-height: 1.6;
}
</style>
