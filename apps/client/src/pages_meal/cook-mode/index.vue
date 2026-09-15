<template>
  <page-meta :page-style="themePageStyle" />
  <Layout
    :class="[themeClasses, { 'cook-layout--immersive': isImmersive }]"
    title=""
    full-screen
    :navbar-capsule-guard="true"
    :navbar-placeholder="!isImmersive"
    :navbar-transparent="isImmersive"
    :navbar-foreground-color="isImmersive ? 'var(--color-overlay-text)' : undefined"
  >
    <template #navbar-center>
      <view class="cook-nav__main" :class="{ 'cook-nav__main--immersive': isImmersive }">
        <text v-if="isImmersive" class="cook-slide__tag">{{ currentStep?.dishTitle }}</text>
        <text v-else class="cook-nav__title">做饭模式</text>
        <view class="cook-nav__settings" hover-class="cook-nav__settings--hover" hover-stay-time="100" @click="openSettings">
          <text class="cookfont icon-account-settings cook-nav__settings-icon" />
        </view>
      </view>
    </template>

    <LoginEmptyState
      v-if="requiresLogin && !sessionStore.isLoggedIn"
      title="登录后继续做饭"
      description="计划、饭局和整桌菜的做饭步骤，需要登录后继续处理。"
    />

    <view v-else class="cook-mode-page" :class="{ 'cook-mode-page--immersive': isImmersive }">
      <view v-if="loading" class="cook-mode-state">加载中...</view>
      <view v-else-if="errorText" class="cook-mode-state cook-mode-state--error" @click="loadData">{{ errorText }}</view>
      <view v-else-if="!steps.length" class="cook-mode-empty">
        <Empty title="还没有可执行步骤" description="先补全菜谱步骤，或先生成这桌菜的做饭建议。" />
      </view>

      <template v-else>
        <view class="cook-toolbar" :class="{ 'cook-toolbar--immersive': isImmersive }">
          <view class="cook-toolbar__top">
            <view class="cook-toolbar__main">
              <text class="cook-toolbar__title">{{ sourceTitle }}</text>
              <text class="cook-toolbar__meta">{{ toolbarMeta }}</text>
            </view>
          </view>

          <scroll-view
            v-if="menuTabs.length > 1"
            id="cook-menu-scroll"
            scroll-x
            scroll-with-animation
            class="cook-toolbar__flow-scroll"
            :scroll-left="menuScrollTarget"
            :show-scrollbar="false"
            @scroll="handleMenuScroll"
          >
            <view class="cook-toolbar__flow-indicator" :style="menuIndicatorStyle" />
            <view
              v-for="(item, index) in menuTabs"
              :key="item.key"
              :id="`cook-menu-${index}`"
              class="cook-toolbar__flow-mode"
              :class="{ 'cook-toolbar__flow-mode--active': selectedDishIndex === index }"
              @click="setSelectedDish(index)"
            >
              {{ item.title }}
            </view>
          </scroll-view>
        </view>

        <view
          class="cook-toolbar__modes cook-toolbar__modes--floating"
          :class="{ 'cook-toolbar__modes--dark': isImmersive }"
          :style="floatingModesStyle"
        >
          <view class="cook-toolbar__mode" :class="{ 'cook-toolbar__mode--active': viewMode === 'list' }" @click="setViewMode('list')">
            列表
          </view>
          <view class="cook-toolbar__mode" :class="{ 'cook-toolbar__mode--active': viewMode === 'swiper' }" @click="setViewMode('swiper')">
            沉浸
          </view>
        </view>

        <view class="cook-content-stage" :class="{ 'cook-content-stage--immersive': isImmersive }">
          <view class="cook-content-stage__flipper">
            <view class="cook-content cook-content--list cook-content-stage__face" :class="{ 'cook-content-stage__face--inactive': isImmersive }">
              <swiper class="cook-list-swiper" :current="selectedDishIndex" :disable-touch="listDishes.length < 2" @change="handleListSwiperChange">
                <swiper-item v-for="dish in listDishes" :key="dish.key" class="cook-list-swiper__item">
                  <scroll-view scroll-y class="cook-list-scroll" :show-scrollbar="false">
                    <view class="cook-list">
                      <view class="cook-step-list">
                        <view v-for="(item, index) in dish.steps" :key="item.id" class="cook-step-card">
                          <text class="cook-step-card__index">
                            <text class="cook-step-card__index-current">{{ index + 1 }} </text>
                            <text class="cook-step-card__index-total">{{ `/ ${dish.steps.length}` }}</text>
                          </text>
                          <image v-if="item.imageUrl" class="cook-step-card__image" :src="item.imageUrl" mode="widthFix" @click.stop="previewDishImages(dish.steps, item.imageUrl)" />
                          <text v-if="item.bodyText" class="cook-step-card__text">{{ item.bodyText }}</text>
                          <text v-if="item.note" class="cook-step-card__note">{{ item.note }}</text>
                        </view>
                      </view>
                    </view>
                  </scroll-view>
                </swiper-item>
              </swiper>
            </view>

            <view class="cook-content cook-content--swiper cook-content-stage__face cook-content-stage__face--back" :class="{ 'cook-content-stage__face--inactive': !isImmersive }">
              <swiper class="cook-swiper" :current="immersiveIndex" :circular="false" @change="handleSwiperChange">
                <swiper-item v-for="(item, index) in immersiveSteps" :key="item.id" class="cook-swiper__item">
                  <view class="cook-slide" :class="[`cook-slide--${item.displayMode}`, { 'cook-slide--reading': isMixedStepReading(item.id) }]" @click="toggleMixedReading(item)">
                    <image v-if="item.imageUrl" class="cook-slide__image" :src="item.imageUrl" mode="widthFix" @click.stop="previewStepImage(item.imageUrl)" />

                    <view class="cook-slide__top">
                      <view class="cook-slide__top-left">
                        <view class="cook-slide__index">
                          <NumberIcon class="cook-slide__index-current" :value="getDishStepIndex(index) + 1" />
                          <text class="cook-slide__index-separator">/</text>
                          <NumberIcon class="cook-slide__index-total" :value="getDishStepCount(index)" />
                        </view>
                        <text v-if="item.durationText" class="cook-slide__time">{{ item.durationText }}</text>
                      </view>
                    </view>

                    <view v-if="item.displayMode === 'text'" class="cook-slide__plain">
                      <text class="cook-slide__plain-text" :class="getPlainTextSizeClass(item.bodyText || item.title)">{{ item.bodyText || item.title }}</text>
                      <text v-if="item.note" class="cook-slide__plain-note">{{ item.note }}</text>
                    </view>
                    <text v-if="item.displayMode === 'text'" class="cookfont icon-quote-right cook-slide__quote cook-slide__quote--right" aria-hidden="true" />

                    <template v-else-if="item.displayMode === 'mixed'">
                      <view class="cook-slide__copy" @click.stop="toggleMixedCopy(item.id)">
                        <text class="cook-slide__copy-text">{{ getMixedStepText(item) }}</text>
                        <text v-if="isMixedTextTruncated(item)" class="cook-slide__copy-more">{{ isMixedTextExpanded(item.id) ? "收起" : "更多" }}</text>
                        <text v-if="item.note" class="cook-slide__copy-note">{{ item.note }}</text>
                      </view>
                    </template>
                  </view>
                </swiper-item>
              </swiper>
            </view>
          </view>
        </view>

        <SheetShell :visible="settingsVisible" title="做饭设置" @close="closeSettings">
          <view class="cook-settings">
            <view class="cook-settings__screen-on">
              <view class="cook-settings__copy">
                <text class="cook-settings__title">页面常亮</text>
                <text class="cook-settings__desc">做饭时保持屏幕常亮</text>
              </view>
              <switch :checked="keepScreenOn" color="var(--color-support-action)" @change="handleKeepScreenOnChange" />
            </view>
          </view>
        </SheetShell>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
import { recipeApi, type RecipeContentSnapshot } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import NumberIcon from "@/components/NumberIcon/NumberIcon.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";
import { mealApi, type MealCookContextResponse } from "../apis/meal";

type SourceType = "recipe" | "plan";
type RecipeKind = "my" | "inspiration" | "collection";
type ViewMode = "list" | "swiper";
type FlowMode = "assistant" | "original";
type StepDisplayMode = "text" | "image" | "mixed";
type StepDurationInfo = {
  text: string;
  seconds: number | null;
};
type CookStep = {
  id: string;
  dishKey: string;
  title: string;
  bodyText: string;
  dishTitle: string;
  sourceTag: "菜谱步骤" | "建议流程";
  recipeId: UUID | null;
  recipeKind: RecipeKind;
  note: string;
  imageUrl: string | null;
  displayMode: StepDisplayMode;
  durationMinutes: number | null;
  durationText: string;
  durationSeconds: number | null;
};

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const { navBarTotalHeight } = useSystemInfo();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const loading = ref(false);
const errorText = ref("");
const sourceType = ref<SourceType>("recipe");
const recipeKind = ref<RecipeKind>("my");
const recipeId = ref<UUID | "">("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const originalSteps = ref<CookStep[]>([]);
const flowMode = ref<FlowMode>("original");
const originalCurrentIndex = ref(0);
const immersiveIndex = ref(0);
const sourceTitle = ref("");
const menuTabs = ref<Array<{ key: string; title: string }>>([]);
const selectedDishIndex = ref(0);
const menuScrollLeft = ref(0);
const menuScrollTarget = ref(0);
const menuIndicatorStyle = ref<Record<string, string>>({ opacity: "0" });
const settingsVisible = ref(false);
const keepScreenOn = ref(false);
const viewMode = ref<ViewMode>("list");
const expandedMixedStepIds = ref<string[]>([]);
const mixedReadingStepId = ref("");

const requiresLogin = computed(() => sourceType.value === "plan");
const isImmersive = computed(() => viewMode.value === "swiper");
const immersiveSlideTopStyle = computed(() => ({ top: `${navBarTotalHeight.value + 12}px` }));
const floatingModesStyle = computed(() => ({ top: `${navBarTotalHeight.value + 12}px` }));
const currentDishSteps = computed(() => {
  const tab = menuTabs.value[selectedDishIndex.value];
  if (!tab) return originalSteps.value;
  const filtered = originalSteps.value.filter(item => item.dishKey === tab.key);
  return filtered.length ? filtered : originalSteps.value;
});
const steps = computed(() => (sourceType.value === "plan" ? currentDishSteps.value : originalSteps.value));
const visibleListSteps = computed(() => steps.value.filter(item => Boolean(item.imageUrl || item.bodyText)));
const listDishes = computed(() => {
  if (sourceType.value !== "plan") return [{ key: "recipe", steps: visibleListSteps.value }];
  return menuTabs.value.map(tab => ({
    key: tab.key,
    steps: originalSteps.value.filter(item => item.dishKey === tab.key && Boolean(item.imageUrl || item.bodyText))
  }));
});
const immersiveSteps = computed(() => (sourceType.value === "plan" ? originalSteps.value : steps.value));
const currentIndex = computed(() => originalCurrentIndex.value);
const hasOriginalFlow = computed(() => originalSteps.value.length > 0);
const canSwitchFlowMode = computed(() => false);
const currentStep = computed(() => {
  return viewMode.value === "swiper" ? immersiveSteps.value[immersiveIndex.value] ?? null : steps.value[currentIndex.value] ?? null;
});
const toolbarMeta = computed(() => {
  return sourceType.value === "plan" ? "当前按各道菜的原步骤继续。" : "当前按原菜谱步骤继续。";
});

onLoad(query => {
  sourceType.value = parseSourceType(query?.source);
  recipeKind.value = parseRecipeKind(query?.kind);
  recipeId.value = parseQueryId(query?.recipeId);
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  void loadData();
});

onShow(() => {
  if (sourceType.value === "plan" && sessionStore.isLoggedIn && !loading.value && !originalSteps.value.length) {
    void loadData();
  }
});

onUnload(() => {
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
    void nextTick(() => {
      if (menuTabs.value.length > 1) void syncMenuVisual(selectedDishIndex.value, false);
    });
  }
}

async function loadRecipeFlow() {
  if (!recipeId.value) {
    throw new Error("缺少菜谱信息");
  }
  const detail = await loadRecipeDetail(recipeKind.value, recipeId.value);
  sourceTitle.value = detail.title || "开始做饭";
  const original = ensureSteps(buildRecipeSteps(detail.id, recipeKind.value, detail.title, detail.content), detail.title || "这道菜", recipeKind.value);
  applyFlowData(original);
}

async function loadPlanFlow() {
  if (!planItemId.value || !planDate.value) {
    throw new Error("缺少计划信息");
  }

  const context = await mealApi.getCookContext(planItemId.value);
  sourceTitle.value = context.title || `${formatPlanDate(context.planDate)} · ${formatMealSlot(context.mealSlot)}`;
  menuTabs.value = context.dishes
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(item => ({ key: `dish-${item.dishId}`, title: item.title }));
  const original = ensureSteps(buildPlanContextSteps(context), sourceTitle.value || "这顿饭", "my");
  applyFlowData(original);
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

function buildRecipeSteps(
  targetRecipeId: UUID,
  targetRecipeKind: RecipeKind,
  dishTitle: string,
  content: RecipeContentSnapshot,
  dishKey = `recipe-${targetRecipeId}`
): CookStep[] {
  const nextSteps: CookStep[] = [];
  content.steps.forEach((item, index) => {
    const bodyText = item.text?.trim() || "";
    if (!bodyText && !item.imageUrl) return;
    const duration = resolveStepDuration(bodyText);
    nextSteps.push({
      id: `recipe-${targetRecipeId}-${index + 1}`,
      dishKey,
      title: resolveRecipeStepTitle(bodyText, index),
      bodyText,
      dishTitle,
      sourceTag: "菜谱步骤",
      recipeId: targetRecipeId,
      recipeKind: targetRecipeKind,
      note: "",
      imageUrl: item.imageUrl || null,
      displayMode: resolveDisplayMode(bodyText, item.imageUrl || null),
      durationMinutes: duration.seconds === null ? null : duration.seconds / 60,
      durationText: duration.text,
      durationSeconds: duration.seconds
    });
  });
  return nextSteps;
}

function buildPlanContextSteps(context: MealCookContextResponse) {
  return context.dishes
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap(dish => {
      const dishKey = `dish-${dish.dishId}`;
      const targetRecipeId = dish.recipeId ?? dish.recipeVersionId;
      const steps = buildRecipeSteps(targetRecipeId, "my", dish.title, dish.content, dishKey);
      return steps.length ? steps : [buildFallbackStep(`plan-fallback-${dish.recipeVersionId}`, dish.title, dishKey)];
    });
}

function buildFallbackStep(id: string, dishTitle: string, dishKey = id): CookStep {
  return {
    id,
    dishKey,
    title: `开始做${dishTitle}`,
    bodyText: "当前没有拿到这道菜的细分步骤，先按原菜谱内容继续，必要时点“查看原菜谱”。",
    dishTitle,
    sourceTag: "菜谱步骤",
    recipeId: null,
    recipeKind: "my",
    note: "",
    imageUrl: null,
    displayMode: "text",
    durationMinutes: null,
    durationText: "",
    durationSeconds: null
  };
}

function ensureSteps(currentSteps: CookStep[], fallbackTitle: string, fallbackKind: RecipeKind): CookStep[] {
  if (currentSteps.length) return currentSteps;
  return [
    {
      id: `empty-${fallbackTitle}`,
      dishKey: `empty-${fallbackTitle}`,
      title: `开始做${fallbackTitle}`,
      bodyText: "当前还没有整理出可执行步骤，请先查看原菜谱或回到上一页补全菜单/建议。",
      dishTitle: fallbackTitle,
      sourceTag: "菜谱步骤",
      recipeId: null,
      recipeKind: fallbackKind,
      note: "",
      imageUrl: null,
      displayMode: "text",
      durationMinutes: null,
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
  if (nextMode === viewMode.value) return;
  if (nextMode === "swiper") {
    const currentListStep = steps.value[currentIndex.value];
    const nextIndex = currentListStep ? immersiveSteps.value.findIndex(item => item.id === currentListStep.id) : 0;
    immersiveIndex.value = nextIndex >= 0 ? nextIndex : 0;
  } else {
    syncDishFromImmersiveStep(immersiveIndex.value);
  }
  viewMode.value = nextMode;
}

function openSettings() {
  settingsVisible.value = true;
}

function closeSettings() {
  settingsVisible.value = false;
}

function setFlowMode(nextMode: FlowMode) {
  if (nextMode !== "original" || !hasOriginalFlow.value) return;
  flowMode.value = "original";
}

function applyFlowData(nextOriginalSteps: CookStep[]) {
  originalSteps.value = nextOriginalSteps;
  originalCurrentIndex.value = 0;
  immersiveIndex.value = 0;
  selectedDishIndex.value = 0;
  menuScrollLeft.value = 0;
  menuScrollTarget.value = 0;
  menuIndicatorStyle.value = { opacity: "0" };
  flowMode.value = "original";
}

function setCurrentStep(index: number) {
  if (index < 0 || index >= steps.value.length) return;
  originalCurrentIndex.value = index;
}

function setSelectedDish(index: number) {
  if (index < 0 || index >= menuTabs.value.length) return;
  const changed = selectedDishIndex.value !== index;
  selectedDishIndex.value = index;
  setCurrentStep(0);
  if (changed) void syncMenuVisual(index, true);
  if (viewMode.value === "swiper") {
    const currentDish = menuTabs.value[index];
    const nextIndex = currentDish ? immersiveSteps.value.findIndex(item => item.dishKey === currentDish.key) : -1;
    immersiveIndex.value = nextIndex >= 0 ? nextIndex : 0;
  }
}

function handleMenuScroll(event: { detail?: { scrollLeft?: number } }) {
  const scrollLeft = Number(event.detail?.scrollLeft ?? 0);
  if (Number.isFinite(scrollLeft) && scrollLeft >= 0) menuScrollLeft.value = scrollLeft;
}

async function syncMenuVisual(index: number, centerMenu: boolean) {
  await nextTick();
  const [container, tab] = await Promise.all([
    uniPlatform.system.measure("#cook-menu-scroll"),
    uniPlatform.system.measure(`#cook-menu-${index}`)
  ]);
  if (!container || !tab) return;
  const menuInset = Math.max(0, tab.top - container.top);
  const tabLeft = Math.max(0, menuScrollLeft.value + tab.left - container.left - menuInset);
  menuIndicatorStyle.value = {
    width: `${tab.width}px`,
    height: `${tab.height}px`,
    transform: `translate(${tabLeft}px, 0)`,
    opacity: "1"
  };
  if (centerMenu) menuScrollTarget.value = Math.max(0, tabLeft + menuInset - (container.width - tab.width) / 2);
}

function handleListSwiperChange(event: { detail?: { current?: number } }) {
  const nextDishIndex = Number(event.detail?.current ?? 0);
  if (!Number.isInteger(nextDishIndex) || nextDishIndex < 0 || nextDishIndex >= listDishes.value.length) return;
  if (nextDishIndex === selectedDishIndex.value) return;
  selectedDishIndex.value = nextDishIndex;
  setCurrentStep(0);
  void syncMenuVisual(nextDishIndex, true);
}

function resetPage() {
  loading.value = false;
  errorText.value = "";
  sourceTitle.value = "";
  resetSteps();
}

function resetSteps() {
  originalSteps.value = [];
  flowMode.value = "original";
  originalCurrentIndex.value = 0;
  immersiveIndex.value = 0;
  menuTabs.value = [];
  selectedDishIndex.value = 0;
  menuScrollLeft.value = 0;
  menuScrollTarget.value = 0;
  menuIndicatorStyle.value = { opacity: "0" };
}

function handleSwiperChange(event: { detail?: { current?: number } }) {
  const nextIndex = Number(event.detail?.current ?? 0);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= immersiveSteps.value.length) return;
  mixedReadingStepId.value = "";
  immersiveIndex.value = nextIndex;
  syncDishFromImmersiveStep(nextIndex);
}

function syncDishFromImmersiveStep(index: number) {
  const currentImmersiveStep = immersiveSteps.value[index];
  if (!currentImmersiveStep) return;
  const nextDishIndex = menuTabs.value.findIndex(item => item.key === currentImmersiveStep.dishKey);
  if (nextDishIndex < 0) {
    originalCurrentIndex.value = index;
    return;
  }
  const changed = selectedDishIndex.value !== nextDishIndex;
  selectedDishIndex.value = nextDishIndex;
  const localIndex = currentDishSteps.value.findIndex(item => item.id === currentImmersiveStep.id);
  originalCurrentIndex.value = localIndex >= 0 ? localIndex : 0;
  if (changed) void syncMenuVisual(nextDishIndex, true);
}

function getDishStepIndex(index: number) {
  const step = immersiveSteps.value[index];
  if (!step) return 0;
  return immersiveSteps.value.slice(0, index).filter(item => item.dishKey === step.dishKey).length;
}

function getDishStepCount(index: number) {
  const step = immersiveSteps.value[index];
  if (!step) return 0;
  return immersiveSteps.value.filter(item => item.dishKey === step.dishKey).length;
}

function getPlainTextSizeClass(text: string) {
  const length = Array.from(text.replace(/\s/g, "")).length;
  if (length > 100) return "cook-slide__plain-text--compact";
  return "";
}

function getMixedStepText(step: CookStep) {
  const text = step.bodyText || step.title;
  if (!isMixedTextTruncated(step) || isMixedTextExpanded(step.id)) return text;
  return `${Array.from(text).slice(0, 100).join("")}…`;
}

function isMixedTextTruncated(step: CookStep) {
  return Array.from(step.bodyText || step.title).length > 100;
}

function isMixedTextExpanded(stepId: string) {
  return expandedMixedStepIds.value.includes(stepId);
}

function toggleMixedCopy(stepId: string) {
  expandedMixedStepIds.value = isMixedTextExpanded(stepId)
    ? expandedMixedStepIds.value.filter(item => item !== stepId)
    : [...expandedMixedStepIds.value, stepId];
}

function isMixedStepReading(stepId: string) {
  return mixedReadingStepId.value === stepId;
}

function toggleMixedReading(step: CookStep) {
  if (step.displayMode !== "mixed") return;
  mixedReadingStepId.value = isMixedStepReading(step.id) ? "" : step.id;
}

async function previewStepImage(imageUrl: string | null) {
  if (!imageUrl) return;
  await uniPlatform.media.previewImage({ urls: [imageUrl], current: imageUrl });
}

async function previewDishImages(dishSteps: CookStep[], current: string | null) {
  if (!current) return;
  const urls = dishSteps.map(item => item.imageUrl).filter((imageUrl): imageUrl is string => Boolean(imageUrl));
  if (!urls.length) return;
  await uniPlatform.media.previewImage({ urls, current });
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

async function automatorApplySession(snapshot: { token: string; uid: number; expiresAt: string }) {
  await sessionStore.setSession(snapshot);
  await loadData();
}

async function automatorReadState() {
  await nextTick();
  return {
    sourceTitle: sourceTitle.value,
    toolbarMeta: toolbarMeta.value,
    flowMode: flowMode.value,
    viewMode: viewMode.value,
    canSwitchFlowMode: canSwitchFlowMode.value,
    assistantStepCount: 0,
    originalStepCount: originalSteps.value.length,
    menuCount: menuTabs.value.length,
    selectedDishIndex: selectedDishIndex.value,
    currentDishStepCount: currentDishSteps.value.length,
    currentStepTitle: currentStep.value?.title ?? "",
    currentSourceTag: currentStep.value?.sourceTag ?? ""
  };
}

async function automatorSetFlowMode(nextMode: FlowMode) {
  setFlowMode(nextMode);
  return automatorReadState();
}

defineExpose({
  automatorApplySession,
  automatorReadState,
  automatorSetFlowMode
});
</script>

<style scoped lang="scss">
.cook-nav__title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cook-nav__main {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 16rpx;
}

.cook-nav__settings {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  width: 64rpx;
  height: 64rpx;
}

.cook-nav__settings--hover {
  opacity: 0.68;
}

.cook-nav__settings-icon {
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.cook-nav__main--immersive .cook-nav__title,
.cook-nav__main--immersive .cook-nav__settings-icon {
  color: var(--color-overlay-text);
}

.cook-nav__main--immersive .cook-slide__tag {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.cook-layout--immersive :deep(.navbar__fixed) {
  background: var(--overlay-image-mask);
}

.cook-mode-page,
.cook-list-scroll {
  height: 100%;
}

.cook-mode-page {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  background: var(--page-warm-bg);
}

.cook-mode-page--immersive {
  background: var(--color-overlay-medium);
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
  color: var(--color-state-danger-text);
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
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx var(--space-page) 16rpx;
}

.cook-toolbar--immersive {
  opacity: 0;
  z-index: 0;
  pointer-events: none;
}

.cook-toolbar__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
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

.cook-toolbar__flow-scroll {
  position: relative;
  width: 100%;
  padding: 8rpx;
  box-sizing: border-box;
  border-radius: 999rpx;
  background: var(--color-surface-soft-card);
  box-shadow: inset 0 0 0 1rpx var(--color-border);
  white-space: nowrap;
}

.cook-toolbar__flow-indicator {
  position: absolute;
  z-index: 0;
  top: 0;
  left: 0;
  border-radius: 999rpx;
  background: var(--color-tag-primary-bg);
  transition: transform 220ms ease, width 220ms ease, opacity 160ms ease;
  pointer-events: none;
}

.cook-toolbar__flow-mode {
  display: inline-flex;
  position: relative;
  z-index: 1;
  align-items: center;
  vertical-align: top;
  margin-right: 8rpx;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  color: var(--color-text-secondary);
}

.cook-toolbar__flow-mode--active {
  color: var(--color-tag-primary-text);
  font-weight: var(--font-weight-medium);
}

.cook-toolbar__modes {
  display: flex;
  gap: 10rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: var(--color-surface-raised);
}

.cook-toolbar__modes--floating {
  position: fixed;
  right: var(--space-page);
  z-index: 10;
  transition: background-color 180ms ease, padding 180ms ease;
}

.cook-toolbar__mode {
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  font-size: 24rpx;
  color: var(--color-text-secondary);
}

.cook-toolbar__mode--active {
  color: var(--color-text-inverse);
  background: var(--button-primary-bg);
}

.cook-toolbar__modes--dark {
  background: var(--color-overlay-control);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
}

.cook-toolbar__modes--dark .cook-toolbar__mode {
  color: var(--color-overlay-text-muted);
  transition: color 180ms ease, background-color 180ms ease, padding 180ms ease, font-size 180ms ease;
}

.cook-toolbar__modes--dark .cook-toolbar__mode--active {
  color: var(--color-text);
  background: var(--color-overlay-text);
}

.cook-content-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  z-index: 1;
  width: 100%;
  overflow: hidden;
  perspective: 1200px;
}

.cook-content-stage__flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 520ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.cook-content-stage--immersive .cook-content-stage__flipper {
  transform: rotateY(180deg);
}

.cook-content {
  min-height: 0;
  overflow: hidden;
}

.cook-content-stage__face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-style: preserve-3d;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

.cook-content-stage__face--back {
  transform: rotateY(180deg);
}

.cook-content-stage__face--inactive {
  pointer-events: none;
}

.cook-content--list {
  display: flex;
  height: 100%;
  min-height: 0;
  padding: 0 var(--space-page);
}

.cook-list-swiper,
.cook-list-swiper__item {
  height: 100%;
}

.cook-list-swiper {
  flex: 1;
  min-height: 0;
}

.cook-list-scroll {
  height: 100%;
  min-height: 0;
}

.cook-list {
  display: flex;
  flex-direction: column;
  padding-bottom: 160rpx;
}

.cook-step-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.cook-step-card {
  padding: 6rpx 0 0;
}

.cook-step-card__index,
.cook-step-card__text,
.cook-step-card__note {
  display: block;
}

.cook-step-card__index {
  color: var(--color-text);
  font-size: 80rpx;
  line-height: 1;
}

.cook-step-card__index-current,
.cook-step-card__index-total {
  display: inline-block;
  font-style: italic;
  vertical-align: baseline;
}

.cook-step-card__index-current {
  padding-right: 10rpx;
  font-size: inherit;
  font-weight: var(--font-weight-semibold);
}

.cook-step-card__index-total {
  font-size: 40rpx;
  font-weight: var(--font-weight-medium);
}

.cook-step-card__image {
  display: block;
  width: 100%;
  margin-top: 16rpx;
  overflow: hidden;
  border-radius: 20rpx;
}

.cook-step-card__text {
  margin-top: 16rpx;
  font-size: 32rpx;
  line-height: 1.6;
  color: var(--color-text);
}

.cook-step-card__note {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.7;
}

.cook-slide__top,
.cook-slide__top-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.cook-slide__top {
  justify-content: space-between;
}

.cook-slide__index {
  display: flex;
  align-items: flex-end;
  gap: 4rpx;
  color: var(--color-overlay-text);
  font-size: 22rpx;
  text-shadow: 0 2rpx 10rpx var(--color-shadow-overlay);
}

.cook-slide__index-current {
  font-size: 100rpx;
  line-height: 80rpx;
  font-style: italic;
}

.cook-slide__index-total {
  font-size: 50rpx;
  line-height: 40rpx;
}

.cook-slide__index-separator {
  font-size: 50rpx;
  line-height: 1;
  margin: 0 10rpx 0 -10rpx;
}

.cook-slide__tag,
.cook-slide__time {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: var(--color-overlay-text);
  background: var(--color-overlay-control);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
}

.cook-slide__copy {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  z-index: 2;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  isolation: isolate;
}

.cook-slide__copy::after {
  position: absolute;
  z-index: -1;
  inset: 0;
  content: "";
  background: var(--overlay-image-mask);
  pointer-events: none;
}

.cook-slide--mixed .cook-slide__top,
.cook-slide--mixed .cook-slide__copy {
  transition: transform 220ms ease, opacity 180ms ease;
}

.cook-slide--mixed.cook-slide--reading .cook-slide__top {
  opacity: 0;
  transform: translateY(-48rpx);
}

.cook-slide--mixed.cook-slide--reading .cook-slide__copy {
  opacity: 0;
  transform: translateY(80rpx);
  pointer-events: none;
}

.cook-slide__copy-text {
  font-size: 36rpx;
  line-height: 1.7;
  color: var(--color-overlay-text-muted);
}

.cook-slide__copy-more {
  align-self: flex-start;
  color: var(--color-overlay-text);
  font-size: 24rpx;
  font-weight: var(--font-weight-medium);
}

.cook-slide__plain-note,
.cook-slide__copy-note {
  font-size: 23rpx;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.cook-content--swiper {
  min-height: 0;
}

.cook-swiper,
.cook-swiper__item,
.cook-slide {
  width: 100%;
  height: 100%;
}

.cook-slide {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.cook-slide__image {
  display: block;
  flex: 0 0 auto;
  width: 100%;
  height: auto;
}

.cook-slide__top {
  position: absolute;
  top: 0;
  right: var(--space-page);
  left: var(--space-page);
  z-index: 3;
}

.cook-slide__plain {
  display: flex;
  position: relative;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22rpx;
  padding: 120rpx 56rpx;
  box-sizing: border-box;
  text-align: center;
}

.cook-slide__quote {
  position: absolute;
  z-index: 1;
  color: var(--color-overlay-text-muted);
  font-size: 72rpx;
  line-height: 1;
  opacity: 0.42;
  pointer-events: none;
}

.cook-slide__quote--right {
  right: 28rpx;
  bottom: calc(72rpx + env(safe-area-inset-bottom));
}

.cook-slide__plain {
  z-index: 2;
}

.cook-slide__plain-text {
  font-size: 54rpx;
  line-height: 1.45;
  font-weight: var(--font-weight-heavy);
  color: var(--color-overlay-text);
}

.cook-slide__plain-text--compact {
  font-size: 46rpx;
  line-height: 1.5;
}

.cook-settings {
  display: flex;
  flex-direction: column;
}

.cook-settings__screen-on {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  padding: 28rpx 0;
}

.cook-settings__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.cook-settings__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-medium);
}

.cook-settings__desc {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}
</style>
