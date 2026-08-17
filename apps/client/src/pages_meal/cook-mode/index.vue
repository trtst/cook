<template>
  <page-meta :page-style="pageStyle" />
  <Layout :title="pageTitle" full-screen>
    <Login
      v-if="requiresLogin && !sessionStore.isLoggedIn"
      title="登录后继续做饭"
      description="计划、饭局和整桌菜的做饭步骤，需要登录后继续处理。"
    />

    <view v-else class="cook-mode-page">
      <view v-if="loading" class="cook-mode-state">加载中...</view>
      <view v-else-if="errorText" class="cook-mode-state cook-mode-state--error" @click="loadData">{{ errorText }}</view>
      <view v-else-if="!steps.length" class="cook-mode-empty">
        <Empty title="还没有可执行步骤" description="先补全菜谱步骤，或先生成这桌菜的做饭建议。" />
      </view>

      <template v-else>
        <view class="cook-toolbar">
          <view class="cook-toolbar__main">
            <text class="cook-toolbar__title">{{ sourceTitle }}</text>
            <text class="cook-toolbar__meta">{{ toolbarMeta }}</text>
          </view>
          <view class="cook-toolbar__modes">
            <view
              class="cook-toolbar__mode"
              :class="{ 'cook-toolbar__mode--active': viewMode === 'list' }"
              @click="setViewMode('list')"
            >
              列表
            </view>
            <view
              class="cook-toolbar__mode"
              :class="{ 'cook-toolbar__mode--active': viewMode === 'swiper' }"
              @click="setViewMode('swiper')"
            >
              沉浸
            </view>
          </view>
        </view>

        <view class="cook-tools">
          <view class="cook-tools__item">
            <text class="cook-tools__label">页面常亮</text>
            <switch :checked="keepScreenOn" color="#2f6f4e" @change="handleKeepScreenOnChange" />
          </view>
          <button v-if="canOpenRecipe" class="cook-tools__link" @click="openCurrentRecipe">查看原菜谱</button>
        </view>

        <view v-if="viewMode === 'list'" class="cook-content cook-content--list">
          <scroll-view scroll-y class="cook-list-scroll" :show-scrollbar="false">
            <view class="cook-list">
              <view
                v-for="(item, index) in steps"
                :key="item.id"
                class="cook-card"
                :class="{
                  'cook-card--active': index === currentIndex,
                  'cook-card--done': completedStepIds.includes(item.id)
                }"
                @click="setCurrentStep(index)"
              >
                <view class="cook-card__top">
                  <view class="cook-card__top-left">
                    <text class="cook-card__index">{{ index + 1 }} / {{ steps.length }}</text>
                    <text class="cook-card__tag">{{ item.sourceTag }}</text>
                  </view>
                  <text v-if="item.durationText" class="cook-card__time">{{ item.durationText }}</text>
                </view>

                <view v-if="item.displayMode === 'text'" class="cook-card__text">
                  <text v-if="item.dishTitle" class="cook-card__dish">{{ item.dishTitle }}</text>
                  <text class="cook-card__title">{{ item.title }}</text>
                  <text class="cook-card__body">{{ item.bodyText || item.title }}</text>
                </view>

                <view v-else-if="item.displayMode === 'image'" class="cook-card__image-only">
                  <image class="cook-card__image" :src="item.imageUrl || ''" mode="aspectFill" />
                </view>

                <view v-else class="cook-card__mixed">
                  <image class="cook-card__image" :src="item.imageUrl || ''" mode="aspectFill" />
                  <view class="cook-card__mixed-mask" />
                  <view class="cook-card__mixed-copy">
                    <text v-if="item.dishTitle" class="cook-card__dish cook-card__dish--overlay">{{ item.dishTitle }}</text>
                    <text class="cook-card__mixed-title">{{ item.title }}</text>
                    <text v-if="item.bodyText" class="cook-card__mixed-body">{{ item.bodyText }}</text>
                  </view>
                </view>

                <view v-if="item.note" class="cook-card__note">{{ item.note }}</view>
              </view>
            </view>
          </scroll-view>
        </view>

        <view v-else class="cook-content cook-content--swiper">
          <swiper class="cook-swiper" :current="currentIndex" :circular="false" @change="handleSwiperChange">
            <swiper-item v-for="(item, index) in steps" :key="item.id" class="cook-swiper__item">
              <view class="cook-slide" :class="[`cook-slide--${item.displayMode}`]">
                <image v-if="item.imageUrl" class="cook-slide__image" :src="item.imageUrl" mode="aspectFill" />

                <view class="cook-slide__top">
                  <view class="cook-slide__top-left">
                    <text class="cook-slide__index">{{ index + 1 }} / {{ steps.length }}</text>
                    <text class="cook-slide__tag">{{ item.sourceTag }}</text>
                  </view>
                  <text v-if="item.durationText" class="cook-slide__time">{{ item.durationText }}</text>
                </view>

                <view v-if="item.displayMode === 'text'" class="cook-slide__plain">
                  <text v-if="item.dishTitle" class="cook-slide__dish">{{ item.dishTitle }}</text>
                  <text class="cook-slide__plain-title">{{ item.title }}</text>
                  <text class="cook-slide__plain-text">{{ item.bodyText || item.title }}</text>
                  <text v-if="item.note" class="cook-slide__plain-note">{{ item.note }}</text>
                </view>

                <template v-else-if="item.displayMode === 'mixed'">
                  <view class="cook-slide__mask" />
                  <view class="cook-slide__copy">
                    <text v-if="item.dishTitle" class="cook-slide__dish cook-slide__dish--overlay">{{ item.dishTitle }}</text>
                    <text class="cook-slide__copy-title">{{ item.title }}</text>
                    <text v-if="item.bodyText" class="cook-slide__copy-text">{{ item.bodyText }}</text>
                    <text v-if="item.note" class="cook-slide__copy-note">{{ item.note }}</text>
                  </view>
                </template>
              </view>
            </swiper-item>
          </swiper>
        </view>

        <view class="cook-bottom">
          <view class="cook-bottom__main">
            <text class="cook-bottom__title">{{ currentStep?.dishTitle || sourceTitle }}</text>
            <text class="cook-bottom__meta">{{ currentStep?.title || "" }}</text>
          </view>

          <view class="cook-bottom__timer">
            <view class="cook-bottom__timer-main">
              <text class="cook-bottom__timer-label">{{ currentStep?.durationText ? "建议时间" : "本步计时" }}</text>
              <text class="cook-bottom__timer-value">{{ timerDisplay }}</text>
            </view>
            <button class="cook-bottom__timer-button" @click="toggleTimer">
              {{ timerRunning ? "结束计时" : "开始计时" }}
            </button>
          </view>

          <view class="cook-bottom__actions">
            <button class="cook-bottom__action cook-bottom__action--ghost" :disabled="currentIndex === 0" @click="goPrev">
              上一步
            </button>
            <button class="cook-bottom__action cook-bottom__action--primary" @click="completeCurrentStep">
              完成这步
            </button>
            <button class="cook-bottom__action cook-bottom__action--ghost" :disabled="currentIndex >= steps.length - 1" @click="goNext">
              下一步
            </button>
          </view>

          <text class="cook-bottom__progress">{{ completedStepIds.length }}/{{ steps.length }} 步已完成</text>
        </view>

        <view v-if="allStepsDone" class="cook-complete">
          <text class="cook-complete__title">这顿饭顺利完成</text>
          <text class="cook-complete__text">所有步骤都完成了，可以准备上桌了。</text>
          <button class="cook-complete__button" @click="goBack">返回详情</button>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
import { recipeApi, type RecipeContentSnapshot } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";
import { mealApi, type MealPlanCookAssistant, type MealPlanSummary } from "../apis/meal";

type SourceType = "recipe" | "plan";
type RecipeKind = "my" | "inspiration" | "collection";
type ViewMode = "list" | "swiper";
type StepDisplayMode = "text" | "image" | "mixed";
type StepDurationInfo = {
  text: string;
  seconds: number | null;
};
type CookStep = {
  id: string;
  title: string;
  bodyText: string;
  dishTitle: string;
  sourceTag: "菜谱步骤" | "建议流程";
  recipeId: UUID | null;
  recipeKind: RecipeKind;
  note: string;
  imageUrl: string | null;
  displayMode: StepDisplayMode;
  durationText: string;
  durationSeconds: number | null;
};

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const sourceType = ref<SourceType>("recipe");
const recipeKind = ref<RecipeKind>("my");
const recipeId = ref<UUID | "">("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const steps = ref<CookStep[]>([]);
const currentIndex = ref(0);
const completedStepIds = ref<string[]>([]);
const sourceTitle = ref("");
const useAssistantFlow = ref(false);
const keepScreenOn = ref(false);
const timerRunning = ref(false);
const elapsedSeconds = ref(0);
const viewMode = ref<ViewMode>("list");

let timerId: ReturnType<typeof setInterval> | null = null;

const pageTitle = computed(() => (allStepsDone.value ? "做饭完成" : "做饭模式"));
const requiresLogin = computed(() => sourceType.value === "plan");
const currentStep = computed(() => steps.value[currentIndex.value] ?? null);
const allStepsDone = computed(() => steps.value.length > 0 && completedStepIds.value.length >= steps.value.length);
const canOpenRecipe = computed(() => {
  if (sourceType.value === "recipe") return Boolean(recipeId.value);
  return Boolean(currentStep.value?.recipeId);
});
const toolbarMeta = computed(() => {
  if (useAssistantFlow.value) return "当前按这桌菜的做饭建议继续。";
  return sourceType.value === "plan" ? "当前按各道菜的原步骤继续。" : "当前按原菜谱步骤继续。";
});
const timerDisplay = computed(() => {
  if (timerRunning.value || elapsedSeconds.value > 0) {
    return formatElapsed(elapsedSeconds.value);
  }
  if (currentStep.value?.durationSeconds != null) {
    return formatElapsed(currentStep.value.durationSeconds);
  }
  return "--:--";
});

onLoad(query => {
  sourceType.value = parseSourceType(query?.source);
  recipeKind.value = parseRecipeKind(query?.kind);
  recipeId.value = parseQueryId(query?.recipeId);
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  void loadData();
});

onUnload(() => {
  stopTimer();
  if (keepScreenOn.value) {
    void uniPlatform.system.setKeepScreenOn(false).catch(() => undefined);
  }
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!requiresLogin.value || isLoggedIn) {
      void loadData();
      return;
    }
    resetPage();
  }
);

watch(currentIndex, () => {
  stopTimer();
  elapsedSeconds.value = 0;
});

async function loadData() {
  if (loading.value) return;
  if (sourceType.value === "plan" && !sessionStore.isLoggedIn) {
    resetPage();
    return;
  }

  loading.value = true;
  errorText.value = "";
  try {
    if (sourceType.value === "plan") {
      await loadPlanFlow();
    } else {
      await loadRecipeFlow();
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "做饭模式加载失败";
    resetSteps();
  } finally {
    loading.value = false;
  }
}

async function loadRecipeFlow() {
  if (!recipeId.value) {
    throw new Error("缺少菜谱信息");
  }
  const detail = await loadRecipeDetail(recipeKind.value, recipeId.value);
  sourceTitle.value = detail.title || "开始做饭";
  useAssistantFlow.value = false;
  steps.value = ensureSteps(buildRecipeSteps(detail.id, recipeKind.value, detail.title, detail.content), detail.title || "这道菜", recipeKind.value);
  currentIndex.value = 0;
  completedStepIds.value = [];
}

async function loadPlanFlow() {
  if (!planItemId.value || !planDate.value) {
    throw new Error("缺少计划信息");
  }

  const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
  const plan = result.items.find(item => item.id === planItemId.value) ?? null;
  if (!plan) {
    throw new Error("这顿饭暂时找不到了");
  }

  sourceTitle.value = `${formatPlanDate(plan.planDate)} · ${formatMealSlot(plan.mealSlot)}`;

  let assistant: MealPlanCookAssistant | null = null;
  try {
    assistant = await mealApi.getCookAssistant(plan.id);
  } catch {
    assistant = null;
  }

  if (assistant?.hasSnapshot && !assistant.isStale) {
    useAssistantFlow.value = true;
    steps.value = ensureSteps(buildAssistantSteps(plan, assistant), sourceTitle.value || "这顿饭", "my");
  } else {
    useAssistantFlow.value = false;
    steps.value = ensureSteps(await buildPlanRecipeSteps(plan), sourceTitle.value || "这顿饭", "my");
  }

  currentIndex.value = 0;
  completedStepIds.value = [];
}

async function loadRecipeDetail(kind: RecipeKind, targetRecipeId: UUID) {
  if (kind === "inspiration") {
    return recipeApi.getInspirationRecipe(targetRecipeId);
  }
  if (kind === "collection") {
    return recipeApi.getCollectionRecipe(targetRecipeId);
  }
  return recipeApi.getMyRecipe(targetRecipeId);
}

function buildRecipeSteps(targetRecipeId: UUID, targetRecipeKind: RecipeKind, dishTitle: string, content: RecipeContentSnapshot): CookStep[] {
  const nextSteps: CookStep[] = [];
  content.steps.forEach((item, index) => {
    const bodyText = item.text?.trim() || "";
    if (!bodyText && !item.imageUrl) return;
    const duration = resolveStepDuration(bodyText);
    nextSteps.push({
      id: `recipe-${targetRecipeId}-${index + 1}`,
      title: resolveRecipeStepTitle(bodyText, index),
      bodyText,
      dishTitle,
      sourceTag: "菜谱步骤",
      recipeId: targetRecipeId,
      recipeKind: targetRecipeKind,
      note: "",
      imageUrl: item.imageUrl || null,
      displayMode: resolveDisplayMode(bodyText, item.imageUrl || null),
      durationText: duration.text,
      durationSeconds: duration.seconds
    });
  });
  return nextSteps;
}

async function buildPlanRecipeSteps(plan: MealPlanSummary) {
  const recipes = await Promise.all(
    plan.menuItems.map(async item => {
      if (!item.recipeId) {
        return [buildFallbackStep(`plan-fallback-${item.recipeVersionId}`, item.title)];
      }
      try {
        const detail = await recipeApi.getMyRecipe(item.recipeId);
        const nextSteps = buildRecipeSteps(detail.id, "my", item.title, detail.content);
        return nextSteps.length ? nextSteps : [buildFallbackStep(`plan-fallback-${item.recipeId}`, item.title)];
      } catch {
        return [buildFallbackStep(`plan-fallback-${item.recipeId}`, item.title)];
      }
    })
  );
  return recipes.flat();
}

function buildAssistantSteps(plan: MealPlanSummary, assistant: MealPlanCookAssistant): CookStep[] {
  const recipeIdByTitle = new Map<string, UUID>();
  for (const item of plan.menuItems) {
    if (item.recipeId) {
      recipeIdByTitle.set(item.title, item.recipeId);
    }
  }

  const stepsFromPrep = assistant.prepTasks.map((item, index) => toAssistantStep(`prep-${index}`, item.title, item.detail, item.dishTitles, recipeIdByTitle));
  const stepsFromTimeline = assistant.cookTimeline.map(item =>
    toAssistantStep(`timeline-${item.order}`, item.title, item.detail, item.dishTitles, recipeIdByTitle)
  );
  const stepsFromServe = assistant.serveTasks.map((item, index) => toAssistantStep(`serve-${index}`, item.title, item.detail, item.dishTitles, recipeIdByTitle));
  return [...stepsFromPrep, ...stepsFromTimeline, ...stepsFromServe];
}

function toAssistantStep(
  id: string,
  title: string,
  detail: string,
  dishTitles: string[],
  recipeIdByTitle: Map<string, UUID>
): CookStep {
  const duration = resolveStepDuration(title, detail);
  const firstDishTitle = dishTitles[0] || "";
  return {
    id,
    title: title.trim() || "开始这一步",
    bodyText: detail.trim() || "按这一步继续往下做。",
    dishTitle: dishTitles.join("、"),
    sourceTag: "建议流程",
    recipeId: firstDishTitle ? recipeIdByTitle.get(firstDishTitle) || null : null,
    recipeKind: "my",
    note: dishTitles.length > 1 ? "这一步同时服务多道菜，做完再往下走。" : "",
    imageUrl: null,
    displayMode: "text",
    durationText: duration.text,
    durationSeconds: duration.seconds
  };
}

function buildFallbackStep(id: string, dishTitle: string): CookStep {
  return {
    id,
    title: `开始做${dishTitle}`,
    bodyText: "当前没有拿到这道菜的细分步骤，先按原菜谱内容继续，必要时点“查看原菜谱”。",
    dishTitle,
    sourceTag: "菜谱步骤",
    recipeId: null,
    recipeKind: "my",
    note: "",
    imageUrl: null,
    displayMode: "text",
    durationText: "",
    durationSeconds: null
  };
}

function ensureSteps(currentSteps: CookStep[], fallbackTitle: string, fallbackKind: RecipeKind): CookStep[] {
  if (currentSteps.length) return currentSteps;
  return [
    {
      id: `empty-${fallbackTitle}`,
      title: `开始做${fallbackTitle}`,
      bodyText: "当前还没有整理出可执行步骤，请先查看原菜谱或回到上一页补全菜单/建议。",
      dishTitle: fallbackTitle,
      sourceTag: "菜谱步骤",
      recipeId: null,
      recipeKind: fallbackKind,
      note: "",
      imageUrl: null,
      displayMode: "text",
      durationText: "",
      durationSeconds: null
    }
  ];
}

function resolveRecipeStepTitle(detail: string, index: number) {
  const shortText = detail.replace(/\s+/g, " ").trim();
  if (!shortText) return `步骤 ${index + 1}`;
  return shortText.length > 18 ? `${shortText.slice(0, 18)}...` : shortText;
}

function resolveDisplayMode(text: string, imageUrl: string | null): StepDisplayMode {
  if (imageUrl && text) return "mixed";
  if (imageUrl) return "image";
  return "text";
}

function resolveStepDuration(...parts: string[]): StepDurationInfo {
  const source = parts.map(item => item.trim()).filter(Boolean).join(" ");
  if (!source) return { text: "", seconds: null };

  const hourMinuteMatch = source.match(/(\d+)\s*小时\s*(\d+)\s*分钟/);
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1]);
    const minutes = Number(hourMinuteMatch[2]);
    return { text: `${hours}小时${minutes}分钟`, seconds: hours * 3600 + minutes * 60 };
  }

  const hourRangeMatch = source.match(/(\d+)\s*(?:-|~|～|至)\s*(\d+)\s*小时/);
  if (hourRangeMatch) {
    const maxHours = Number(hourRangeMatch[2]);
    return { text: `${hourRangeMatch[1]}-${hourRangeMatch[2]}小时`, seconds: maxHours * 3600 };
  }

  const minuteRangeMatch = source.match(/(\d+)\s*(?:-|~|～|至)\s*(\d+)\s*分钟/);
  if (minuteRangeMatch) {
    const maxMinutes = Number(minuteRangeMatch[2]);
    return { text: `${minuteRangeMatch[1]}-${minuteRangeMatch[2]}分钟`, seconds: maxMinutes * 60 };
  }

  if (source.includes("半小时")) {
    return { text: "半小时", seconds: 30 * 60 };
  }

  const hourMatch = source.match(/(\d+)\s*小时/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    return { text: `${hours}小时`, seconds: hours * 3600 };
  }

  const minuteMatch = source.match(/(\d+)\s*分钟/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    return { text: `${minutes}分钟`, seconds: minutes * 60 };
  }

  return { text: "", seconds: null };
}

function setViewMode(nextMode: ViewMode) {
  viewMode.value = nextMode;
}

function setCurrentStep(index: number) {
  if (index < 0 || index >= steps.value.length) return;
  currentIndex.value = index;
}

function resetPage() {
  loading.value = false;
  errorText.value = "";
  sourceTitle.value = "";
  useAssistantFlow.value = false;
  resetSteps();
}

function resetSteps() {
  steps.value = [];
  currentIndex.value = 0;
  completedStepIds.value = [];
  stopTimer();
  elapsedSeconds.value = 0;
}

function handleSwiperChange(event: { detail?: { current?: number } }) {
  const nextIndex = Number(event.detail?.current ?? 0);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= steps.value.length) return;
  currentIndex.value = nextIndex;
}

function goPrev() {
  if (currentIndex.value <= 0) return;
  currentIndex.value -= 1;
}

function goNext() {
  if (currentIndex.value >= steps.value.length - 1) return;
  currentIndex.value += 1;
}

function completeCurrentStep() {
  const step = currentStep.value;
  if (!step) return;
  if (!completedStepIds.value.includes(step.id)) {
    completedStepIds.value = [...completedStepIds.value, step.id];
  }
  if (currentIndex.value < steps.value.length - 1) {
    currentIndex.value += 1;
    return;
  }
  stopTimer();
}

function toggleTimer() {
  if (timerRunning.value) {
    stopTimer();
    return;
  }
  timerRunning.value = true;
  timerId = setInterval(() => {
    elapsedSeconds.value += 1;
  }, 1000);
}

function stopTimer() {
  timerRunning.value = false;
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
}

async function handleKeepScreenOnChange(event: Event) {
  const nextValue = Boolean((event as unknown as { detail?: { value?: boolean } }).detail?.value);
  try {
    await uniPlatform.system.setKeepScreenOn(nextValue);
    keepScreenOn.value = nextValue;
  } catch {
    keepScreenOn.value = false;
    await uniPlatform.feedback.toast({ title: "页面常亮设置失败", icon: "none" });
  }
}

function openCurrentRecipe() {
  if (sourceType.value === "recipe" && recipeId.value) {
    void uniPlatform.navigation.navigateTo(
      `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId.value))}&kind=${encodeURIComponent(recipeKind.value)}`
    );
    return;
  }
  if (!currentStep.value?.recipeId) return;
  void uniPlatform.navigation.navigateTo(
    `/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(currentStep.value.recipeId))}&kind=${encodeURIComponent(currentStep.value.recipeKind)}`
  );
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  });
}

function parseSourceType(value: unknown): SourceType {
  const text = parseQueryText(value);
  return text === "plan" ? "plan" : "recipe";
}

function parseRecipeKind(value: unknown): RecipeKind {
  const text = parseQueryText(value);
  if (text === "inspiration" || text === "collection") return text;
  return "my";
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

function formatElapsed(totalSeconds: number) {
  const minute = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const second = String(totalSeconds % 60).padStart(2, "0");
  return `${minute}:${second}`;
}
</script>

<style scoped lang="scss">
.cook-mode-page {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  background: linear-gradient(180deg, #f7f2e7 0%, #f4edde 18%, #f7f4ee 100%);
}

.cook-mode-state,
.cook-mode-empty {
  display: flex;
  width: 100%;
  flex: 1;
  box-sizing: border-box;
}

.cook-mode-state {
  padding: 56rpx var(--space-page);
  color: var(--color-text-secondary);
}

.cook-mode-state--error {
  color: var(--color-danger);
}

.cook-mode-empty {
  padding: 24rpx;
}

.cook-mode-empty :deep(.empty-state--art) {
  width: 100%;
  margin-top: 0;
}

.cook-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx var(--space-page) 16rpx;
}

.cook-toolbar__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
}

.cook-toolbar__title {
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.cook-toolbar__meta {
  font-size: 24rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.cook-toolbar__modes {
  display: flex;
  gap: 10rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-primary) 8%, #fff 92%);
}

.cook-toolbar__mode {
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--color-text-secondary);
}

.cook-toolbar__mode--active {
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
}

.cook-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 0 var(--space-page) 16rpx;
}

.cook-tools__item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.cook-tools__label {
  font-size: 24rpx;
  color: var(--color-text-secondary);
}

.cook-tools__link {
  padding: 0;
  font-size: 24rpx;
  color: var(--color-primary);
  background: transparent;
}

.cook-tools__link::after,
.cook-bottom__timer-button::after,
.cook-bottom__action::after,
.cook-complete__button::after {
  border: none;
}

.cook-content {
  flex: 1;
  min-height: 0;
}

.cook-content--list {
  padding: 0 var(--space-page);
}

.cook-list-scroll {
  height: 100%;
}

.cook-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 250rpx;
}

.cook-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: 28rpx;
  background: color-mix(in srgb, var(--color-surface) 94%, #fff 6%);
  box-shadow: 0 18rpx 40rpx color-mix(in srgb, #8a6b3d 10%, transparent);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.cook-card--active {
  transform: translateY(-4rpx);
  box-shadow: 0 24rpx 52rpx color-mix(in srgb, #8a6b3d 16%, transparent);
}

.cook-card--done {
  opacity: 0.7;
}

.cook-card__top,
.cook-slide__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.cook-card__top-left,
.cook-slide__top-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.cook-card__index,
.cook-card__tag,
.cook-card__time,
.cook-slide__index,
.cook-slide__tag,
.cook-slide__time {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
}

.cook-card__index,
.cook-card__tag,
.cook-card__time {
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-primary) 8%, #fff 92%);
}

.cook-slide__index,
.cook-slide__tag,
.cook-slide__time {
  color: #fff;
  backdrop-filter: blur(18rpx);
  background: rgba(17, 15, 11, 0.42);
}

.cook-card__text {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.cook-card__dish,
.cook-slide__dish {
  font-size: 24rpx;
  color: var(--color-primary);
}

.cook-card__title {
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.cook-card__body {
  font-size: 28rpx;
  line-height: 1.75;
  color: var(--color-text);
}

.cook-card__image-only,
.cook-card__mixed {
  position: relative;
  overflow: hidden;
  border-radius: 24rpx;
}

.cook-card__image-only {
  height: 420rpx;
}

.cook-card__mixed {
  height: 460rpx;
}

.cook-card__image,
.cook-slide__image {
  width: 100%;
  height: 100%;
}

.cook-card__mixed-mask,
.cook-slide__mask {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 58%;
  background: linear-gradient(180deg, rgba(10, 9, 7, 0) 0%, rgba(10, 9, 7, 0.18) 28%, rgba(10, 9, 7, 0.92) 100%);
}

.cook-card__mixed-copy,
.cook-slide__copy {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 0 24rpx 24rpx;
  box-sizing: border-box;
}

.cook-card__dish--overlay,
.cook-slide__dish--overlay {
  color: rgba(255, 242, 224, 0.9);
}

.cook-card__mixed-title,
.cook-slide__copy-title {
  font-size: 32rpx;
  font-weight: var(--font-weight-heavy);
  color: #fffdf7;
}

.cook-card__mixed-body,
.cook-slide__copy-text {
  font-size: 25rpx;
  line-height: 1.7;
  color: rgba(255, 250, 242, 0.92);
}

.cook-card__note,
.cook-slide__plain-note,
.cook-slide__copy-note {
  font-size: 23rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.cook-content--swiper {
  padding-bottom: 250rpx;
}

.cook-swiper,
.cook-swiper__item,
.cook-slide {
  width: 100%;
  height: 100%;
}

.cook-slide {
  position: relative;
  overflow: hidden;
  background: #15120d;
}

.cook-slide__top {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  left: 24rpx;
  z-index: 3;
}

.cook-slide__plain {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22rpx;
  padding: 120rpx 56rpx;
  box-sizing: border-box;
  text-align: center;
}

.cook-slide__plain-title {
  font-size: 32rpx;
  font-weight: var(--font-weight-heavy);
  color: rgba(255, 255, 255, 0.88);
}

.cook-slide__plain-text {
  font-size: 54rpx;
  line-height: 1.45;
  font-weight: var(--font-weight-heavy);
  color: #fff9f0;
}

.cook-bottom {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 18rpx var(--space-page) calc(18rpx + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-surface) 94%, #fff 6%);
  box-shadow: 0 -18rpx 40rpx color-mix(in srgb, var(--color-surface-mask-medium) 40%, transparent);
}

.cook-bottom__main,
.cook-bottom__timer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}

.cook-bottom__title {
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.cook-bottom__meta,
.cook-bottom__timer-label,
.cook-bottom__progress {
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.cook-bottom__timer-main {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.cook-bottom__timer-value {
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  color: var(--color-text);
}

.cook-bottom__timer-button,
.cook-complete__button {
  min-width: 180rpx;
  height: 78rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: var(--font-weight-heavy);
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  box-shadow: var(--button-primary-shadow);
}

.cook-bottom__actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.cook-bottom__action {
  height: 84rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
}

.cook-bottom__action--primary {
  color: #fff;
  background: linear-gradient(135deg, var(--button-primary-gradient-start), var(--button-primary-gradient-end));
  box-shadow: var(--button-primary-shadow);
}

.cook-bottom__action--ghost {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 9%, #fff 91%);
}

.cook-complete {
  position: fixed;
  right: 24rpx;
  bottom: calc(220rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  z-index: 11;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(18, 16, 12, 0.92);
  backdrop-filter: blur(22rpx);
}

.cook-complete__title {
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
  color: #fffdf7;
}

.cook-complete__text {
  font-size: 25rpx;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.72);
}
</style>
