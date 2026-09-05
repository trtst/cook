<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="随机一下" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="random-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="random-scroll" scroll-y :show-scrollbar="false" @scroll="handleRandomScroll">
      <view class="random-page">
        <view class="random-hero" :style="heroStyle">
          <text class="random-hero__eyebrow">帮我决定</text>
          <text class="random-hero__title">{{ heroTitle }}</text>
          <text class="random-hero__description">{{ heroDescription }}</text>
        </view>

        <view class="random-content">
          <RandomConditionBar
            :meal-slot="state.conditions.mealSlot"
            :people-count="state.conditions.peopleCount"
            :fridge-preferred="state.conditions.fridgePreferred"
            :slot-plan="state.slotPlan"
            :loading="conditionLoading"
            @select-meal-slot="selectMealSlot"
            @select-people-count="selectPeopleCount"
            @toggle-fridge-preferred="toggleFridgePreferred"
            @adjust-slot-plan="adjustSlotPlan"
          />
          <view v-if="errorText" class="notice" @click="clearError">
            <text class="notice__text">{{ errorText }}</text>
            <text class="notice__action">知道了</text>
          </view>

          <template v-if="hasMenu">
            <view class="board-card">
              <view class="board-card__head">
                <view>
                  <text class="board-card__eyebrow">当前这一桌</text>
                  <text class="board-card__title">{{ boardTitle }}</text>
                </view>
                <text class="board-card__badge">{{ boardBadge }}</text>
              </view>
              <text class="board-card__description">{{ boardDescription }}</text>

              <view class="board-card__summary">
                <text class="board-card__summary-item">当前 {{ activeSlots.length }} 道</text>
                <text class="board-card__summary-item">已划掉 {{ removedCount }} 道</text>
              </view>

              <view class="slot-list">
                <RandomSlotCard
                  v-for="menuSlot in state.slots"
                  :key="menuSlot.slotId"
                  :item="menuSlot"
                  :disabled="slotActionLocked"
                  @toggle-lock="toggleSlotLock"
                  @remove="removeSlot"
                  @replace="replaceSlot"
                />
              </view>
            </view>

            <RandomBottomBar
              :title="bottomTitle"
              :description="bottomDescription"
              :loading="conditionLoading"
              :plan-disabled="!canCreatePlan"
              @create-plan="openPlanSheet"
            />
          </template>
        </view>
      </view>
    </scroll-view>

    <view class="random-generate-bar">
      <text class="random-generate-bar__quota">{{ quotaText }}</text>
      <view class="random-generate-bar__buttons">
        <button
          class="random-generate-bar__button random-generate-bar__button--primary"
          :disabled="generateDisabled || conditionLoading"
          @click="generateMenu"
        >
          {{ conditionLoading ? "处理中..." : hasMenu ? "再来一桌" : "生成一桌" }}
        </button>
      </view>
    </view>

    <SheetShell
      v-if="planSheetMounted"
      :visible="planSheetVisible"
      title="加入计划"
      subtitle="先确认要安排到哪一天，这次只影响当前这顿。"
      @close="handlePlanSheetClose"
      @after-close="handlePlanSheetAfterClose"
    >
      <view class="plan-sheet">
        <view class="plan-sheet__summary">
          <text class="plan-sheet__label">当前餐次</text>
          <text class="plan-sheet__value">{{ mealSlotLabel(state.conditions.mealSlot) }}</text>
        </view>
        <view class="plan-sheet__summary">
          <text class="plan-sheet__label">安排日期</text>
          <picker mode="date" :disabled="planSubmitting" :value="planDate" @change="handlePlanDateChange">
            <view class="plan-sheet__picker">{{ planDate }}</view>
          </picker>
        </view>
        <view class="plan-sheet__tips">
          <text class="plan-sheet__tips-text">这桌里食材不足的菜会一起写入计划，并标记为 `待采购`。</text>
        </view>
        <view v-if="inspirationSlots.length" class="plan-sheet__inspiration">
          <view class="plan-sheet__section-head">
            <view>
              <text class="plan-sheet__section-title">灵感菜谱归入私房菜</text>
              <text class="plan-sheet__section-note">每道菜都需要选择分类，没有分类时请先创建。</text>
            </view>
            <view class="plan-sheet__category-action" @click="toggleCategoryCreator">
              {{ showCategoryCreator ? "取消" : "创建分类" }}
            </view>
          </view>
          <view v-if="showCategoryCreator" class="plan-sheet__creator">
            <input v-model="categoryDraftName" class="plan-sheet__creator-input" maxlength="4" placeholder="输入分类名称" :disabled="categorySubmitting" />
            <button class="plan-sheet__creator-button" :disabled="categorySubmitting || !categoryDraftName.trim()" @click="createCategory">
              {{ categorySubmitting ? "创建中" : "确定" }}
            </button>
          </view>
          <text v-if="categoryLoading" class="plan-sheet__section-note">正在加载你的分类...</text>
          <text v-else-if="!categories.length" class="plan-sheet__section-note">还没有个人分类，请先创建一个。</text>
          <view v-for="item in inspirationSlots" :key="item.recipeVersionId" class="plan-sheet__category-row">
            <text class="plan-sheet__category-title">{{ item.title }}</text>
            <view class="plan-sheet__category-chips">
              <view
                v-for="category in categories"
                :key="category.id"
                class="plan-sheet__category-chip"
                :class="{ 'plan-sheet__category-chip--active': selectedCategoryIds[item.recipeVersionId] === category.id }"
                @click="selectCategory(item.recipeVersionId, category.id)"
              >
                {{ category.name }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <template #footer>
        <view class="plan-sheet__footer">
          <button class="secondary plan-sheet__button" @click="closePlanSheet">取消</button>
          <button class="primary plan-sheet__button" :disabled="planSubmitting || !planReady" @click="createPlan">
            {{ planSubmitting ? "保存中..." : "确认加入计划" }}
          </button>
        </view>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import { recipeApi, type RecipeCategorySummary } from "@/apis/recipe";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { APP_STORAGE_KEYS, uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { useSettingsStore, type ThemeMode, type ThemePalette, type ThemeSkin } from "@/stores/settings";
import { useTheme } from "@/composables/useTheme";
import { restoreAppSession } from "@/utils/session";
import { formatMealSlot, resolveMealSlotByTime } from "@/utils/meal-slot";
import { formatThemeText } from "@/themes";
import { createOperationId } from "@/utils/operation-id";
import { mealApi, type CreateMealPlanRequest } from "../apis/meal";
import {
  randomMealApi,
  type MealSlot,
  type RandomMenuItem,
  type RandomMenuQuotaResponse,
  type RandomSlotPlan,
  type RecipeSlotType
} from "../apis/random";
import RandomBottomBar from "../components/RandomBottomBar.vue";
import RandomConditionBar from "../components/RandomConditionBar.vue";
import RandomSlotCard from "../components/RandomSlotCard.vue";
import { todayText } from "../utils/date";
import {
  buildGapState,
  createEmptyGapState,
  createRandomSlotViewModel,
  type RandomPageState,
  type RandomPlanMenuItemInput,
  type RandomSlotViewModel
} from "../types/random";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();
const settingsStore = useSettingsStore();
const { themeVars, themeClasses, effectiveSkin, effectivePalette, themeMode, canSwitchPalette } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));

const RANDOM_NAV_GAP = 16;
const RANDOM_NAV_FADE_DISTANCE = 96;
const MAX_SLOT_TOTAL = 12;

interface RandomMenuConditionSnapshot {
  mealSlot?: MealSlot | null;
  peopleCount?: number | null;
  fridgePreferred?: boolean;
}

const currentThemeText = computed(() => {
  return formatThemeText(themeMode.value, effectiveSkin.value, effectivePalette.value, canSwitchPalette.value);
});

const state = ref<RandomPageState>({
  pageStatus: "IDLE",
  conditions: {
    mealSlot: null,
    peopleCount: null,
    fridgePreferred: false
  },
  slotPlan: null,
  slots: [],
  gap: createEmptyGapState()
});
const errorText = ref("");
const randomScrollTop = ref(0);
const pageMutating = ref(false);
const gapRequestSeq = ref(0);
const planSheetMounted = ref(false);
const planSheetVisible = ref(false);
const planDate = ref(todayText());
const planSubmitting = ref(false);
const categoryLoading = ref(false);
const categorySubmitting = ref(false);
const categories = ref<RecipeCategorySummary[]>([]);
const selectedCategoryIds = ref<Record<string, UUID | null>>({});
const categoryDraftName = ref("");
const showCategoryCreator = ref(false);
const quota = ref<RandomMenuQuotaResponse | null>(null);
const quotaLoading = ref(false);
const rejectedRecipeVersionIds = ref<UUID[]>([]);
const loginRedirecting = ref(false);

const hasMenu = computed(() => state.value.slots.length > 0);
const activeSlots = computed(() => state.value.slots.filter(item => item.status !== "REMOVED"));
const removedCount = computed(() => state.value.slots.filter(item => item.status === "REMOVED").length);
const quotaDepleted = computed(() => Boolean(quota.value && quota.value.remainingCount <= 0));
const generateDisabled = computed(() => !state.value.conditions.mealSlot || !state.value.conditions.peopleCount || quotaDepleted.value);
const submitLoading = computed(() => planSubmitting.value);
const conditionLoading = computed(() => pageMutating.value || state.value.gap.loading || submitLoading.value);
const slotActionLocked = computed(() => pageMutating.value || state.value.gap.loading || submitLoading.value);
const canCreatePlan = computed(() => activeSlots.value.length > 0);
const inspirationSlots = computed(() => activeSlots.value.filter(item => item.sourceType === "INSPIRATION"));
const planReady = computed(() => {
  if (!canCreatePlan.value) return false;
  return inspirationSlots.value.every(item => selectedCategoryIds.value[item.recipeVersionId]);
});

const heroTitle = computed(() => {
  if (!state.value.conditions.mealSlot) return "想轻松定下这顿饭，先选个餐次吧";
  if (!hasMenu.value) return "先生成一桌，再慢慢挑合适的";
  return "先看看这一桌合不合适，再决定下一步";
});

const heroDescription = computed(() => {
  if (!state.value.conditions.mealSlot) return "先选餐次、人数和是否优先用冰箱食材，我再按这顿饭的节奏帮你搭一桌菜单。";
  if (!hasMenu.value) return "会先给你一桌参考菜单，喜欢的留着，不合适的再换一道，不用一下子做完决定。";
  return "把想保留的和想更换的先定下来，再决定要不要写进计划。";
});

const boardTitle = computed(() => {
  const mealLabel = mealSlotLabel(state.value.conditions.mealSlot);
  const peopleLabel = peopleCountLabel(state.value.conditions.peopleCount);
  return `${mealLabel} · ${peopleLabel}`;
});

const boardBadge = computed(() => {
  if (!state.value.conditions.fridgePreferred) return "不强制清冰箱";
  return "优先用冰箱";
});

const quotaText = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后查看本周生成次数";
  if (quotaLoading.value) return "正在同步生成次数";
  if (!quota.value) return "生成次数以后台为准";
  return `本周还可生成 ${quota.value.remainingCount}/${quota.value.limitCount} 次`;
});

const boardDescription = computed(() => {
  return "不合适的直接划掉，想换口味就换一道；喜欢这桌，再安排进计划。";
});

const bottomTitle = computed(() => {
  if (state.value.gap.loading) return "正在比对这桌和冰箱";
  return "这桌可以加入计划";
});

const bottomDescription = computed(() => {
  if (state.value.gap.loading) return "这一步只对比冰箱现有食材，不在这里逐个确认库存。";
  return "喜欢这桌的话，直接加入计划，后续在计划里继续处理食材。";
});

const navProgress = computed(() => Math.min(1, Math.max(0, randomScrollTop.value / RANDOM_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + RANDOM_NAV_GAP}px`
}));

onLoad(query => {
  const mealSlot = parseMealSlot(query?.mealSlot);
  const peopleCount = parsePeopleCount(query?.peopleCount);
  const fridgePreferred = parseBoolean(query?.fridgePreferred);
  const cachedConditions = readRandomMenuConditionSnapshot();

  state.value.conditions.mealSlot = mealSlot ?? cachedConditions.mealSlot ?? resolveDefaultRandomMealSlot();
  state.value.conditions.peopleCount = peopleCount ?? cachedConditions.peopleCount ?? 2;
  state.value.conditions.fridgePreferred = fridgePreferred ?? cachedConditions.fridgePreferred ?? false;

  syncSlotPlan();
});

onShow(() => {
  void ensureRandomPageAccess();
});

async function ensureRandomPageAccess() {
  if (!sessionStore.restored) {
    await restoreAppSession();
  }
  if (!sessionStore.isLoggedIn) {
    redirectGuestToHomeLogin();
    return;
  }
  syncSlotPlan();
  void loadRandomQuota();
}

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      quota.value = null;
      resetRandomState();
      return;
    }
    syncSlotPlan();
    void loadRandomQuota();
  }
);

watch(
  () => [state.value.conditions.mealSlot, state.value.conditions.peopleCount] as const,
  () => {
    syncSlotPlan();
    if (!hasMenu.value) {
      state.value.pageStatus = generateDisabled.value ? "IDLE" : "CONFIG_READY";
    }
  }
);

function resetRandomState() {
  state.value = {
    pageStatus: "IDLE",
    conditions: {
      mealSlot: state.value.conditions.mealSlot,
      peopleCount: state.value.conditions.peopleCount,
      fridgePreferred: state.value.conditions.fridgePreferred
    },
    slotPlan: buildDefaultSlotPlan(state.value.conditions.mealSlot, state.value.conditions.peopleCount),
    slots: [],
    gap: createEmptyGapState()
  };
  errorText.value = "";
  rejectedRecipeVersionIds.value = [];
}

function clearError() {
  errorText.value = "";
}

function redirectGuestToHomeLogin() {
  if (loginRedirecting.value) return;
  loginRedirecting.value = true;
  void uniPlatform.navigation.reLaunch("/pages/home/index?login=random").finally(() => {
    loginRedirecting.value = false;
  });
}

async function loadRandomQuota() {
  if (!sessionStore.isLoggedIn || quotaLoading.value) return;
  quotaLoading.value = true;
  try {
    quota.value = await randomMealApi.getQuota();
  } catch (error) {
    if (!quota.value) {
      errorText.value = error instanceof Error ? error.message : "生成次数同步失败";
    }
  } finally {
    quotaLoading.value = false;
  }
}

function syncSlotPlan() {
  state.value.slotPlan = buildDefaultSlotPlan(state.value.conditions.mealSlot, state.value.conditions.peopleCount);
}

function selectMealSlot(value: MealSlot) {
  if (conditionLoading.value) return;
  state.value.conditions.mealSlot = value;
  void persistRandomMenuConditions();
  clearMenuAndGap();
}

function selectPeopleCount(value: number) {
  if (conditionLoading.value) return;
  state.value.conditions.peopleCount = value;
  void persistRandomMenuConditions();
  clearMenuAndGap();
}

function toggleFridgePreferred() {
  if (!ensureLoggedIn(() => {
    toggleFridgePreferred();
  })) return;
  if (conditionLoading.value) return;
  state.value.conditions.fridgePreferred = !state.value.conditions.fridgePreferred;
  void persistRandomMenuConditions();
  clearMenuAndGap();
}

function adjustSlotPlan(key: keyof RandomSlotPlan, delta: -1 | 1) {
  if (conditionLoading.value) return;
  if (!state.value.slotPlan) return;
  const next = { ...state.value.slotPlan };
  next[key] = clampCount(next[key] + delta);
  if (slotPlanTotal(next) > MAX_SLOT_TOTAL) return;
  state.value.slotPlan = next;
  clearMenuAndGap();
}

function clearMenuAndGap() {
  state.value.slots = [];
  state.value.gap = createEmptyGapState();
  rejectedRecipeVersionIds.value = [];
  errorText.value = "";
  if (sessionStore.isLoggedIn) {
    state.value.pageStatus = generateDisabled.value ? "IDLE" : "CONFIG_READY";
  }
}

async function generateMenu() {
  if (!ensureLoggedIn(() => {
    void generateMenu();
  })) return;
  if (generateDisabled.value || !state.value.conditions.mealSlot || !state.value.conditions.peopleCount || !state.value.slotPlan || pageMutating.value) return;
  const isReroll = hasMenu.value;
  const lockedSlots = state.value.slots.filter(item => item.status === "LOCKED");
  const openSlots = state.value.slots.filter(item => item.status !== "LOCKED");
  if (isReroll && openSlots.length === 0) {
    await uniPlatform.feedback.toast({ title: "已锁定整桌，先解锁再重摇", icon: "none" });
    return;
  }
  const requestSlotPlan = isReroll ? buildSlotPlanForSlots(openSlots) : state.value.slotPlan;
  const requestRejectedVersionIds = isReroll
    ? uniqueIds([
        ...rejectedRecipeVersionIds.value,
        ...openSlots.map(item => item.recipeVersionId)
      ])
    : [];
  pageMutating.value = true;
  state.value.pageStatus = "MENU_MUTATING";
  errorText.value = "";
  try {
    const result = await randomMealApi.generateMenu({
      mealSlot: state.value.conditions.mealSlot,
      peopleCount: state.value.conditions.peopleCount,
      fridgePreferred: state.value.conditions.fridgePreferred,
      slotPlan: requestSlotPlan,
      currentItems: lockedSlots.map(toCurrentRandomItem),
      rejectedRecipeVersionIds: requestRejectedVersionIds
    }, createOperationId());
    quota.value = result.quota;
    if (isReroll) {
      rejectedRecipeVersionIds.value = requestRejectedVersionIds;
      if (result.items.length === 0) {
        state.value.pageStatus = "MENU_READY";
        await uniPlatform.feedback.toast({ title: "暂时没有更多可换的菜了", icon: "none" });
        return;
      }
      state.value.slots = mergeRerollSlots(lockedSlots, openSlots, result.items);
    } else {
      rejectedRecipeVersionIds.value = [];
      state.value.slotPlan = result.slotPlan;
      state.value.slots = result.items.map(createRandomSlotViewModel);
    }
    await refreshGap(true);
    state.value.pageStatus = "MENU_READY";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "生成失败";
    state.value.pageStatus = hasMenu.value ? "MENU_READY" : "CONFIG_READY";
  } finally {
    pageMutating.value = false;
  }
}

function removeSlot(slotId: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  const slot = state.value.slots.find(item => item.slotId === slotId);
  if (slot) markRejectedRecipeVersion(slot.recipeVersionId);
  updateSlot(slotId, slot => {
    slot.status = "REMOVED";
  });
  syncGapPreview();
}

function toggleSlotLock(slotId: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  updateSlot(slotId, slot => {
    if (slot.status === "REMOVED") return;
    slot.status = slot.status === "LOCKED" ? "RECOMMENDED" : "LOCKED";
  });
}

async function replaceSlot(slotId: string) {
  if (state.value.gap.loading || submitLoading.value) return;
  const slot = state.value.slots.find(item => item.slotId === slotId);
  if (!slot || slot.status === "REPLACING" || !state.value.conditions.mealSlot || !state.value.conditions.peopleCount || !state.value.slotPlan) return;

  const previousStatus = slot.status;
  const requestSeq = slot.requestSeq + 1;
  updateSlot(slotId, current => {
    current.requestSeq = requestSeq;
    current.status = "REPLACING";
  });
  state.value.pageStatus = "MENU_MUTATING";
  errorText.value = "";

  try {
    const result = await randomMealApi.replaceSlot({
      mealSlot: state.value.conditions.mealSlot,
      peopleCount: state.value.conditions.peopleCount,
      fridgePreferred: state.value.conditions.fridgePreferred,
      slotPlan: state.value.slotPlan,
      currentItems: buildCurrentItems(slotId),
      targetSlotId: slot.slotId,
      targetSlotType: slot.slotType,
      replaceConstraints: slot.replaceConstraints,
      rejectedRecipeVersionIds: uniqueIds([...rejectedRecipeVersionIds.value, slot.recipeVersionId]),
      requestSeq
    });

    if (result.requestSeq !== requestSeq) return;
    markRejectedRecipeVersion(slot.recipeVersionId);

    if (!result.slot) {
      updateSlot(slotId, current => {
        current.status = previousStatus === "REMOVED" ? "REMOVED" : "RECOMMENDED";
      });
      return;
    }

    updateSlot(slotId, current => {
      const next = createRandomSlotViewModel(result.slot!);
      current.slotIndex = next.slotIndex;
      current.recipeId = next.recipeId;
      current.recipeVersionId = next.recipeVersionId;
      current.title = next.title;
      current.coverUrl = next.coverUrl;
      current.servings = next.servings;
      current.duration = next.duration;
      current.durationText = next.durationText;
      current.estimatedCalories = next.estimatedCalories;
      current.flavorTags = next.flavorTags;
      current.mainProteinType = next.mainProteinType;
      current.fridgeFit = next.fridgeFit;
      current.matchedIngredients = next.matchedIngredients;
      current.sourceType = next.sourceType;
      current.recommendationReason = next.recommendationReason;
      current.latestAppliedSeq = requestSeq;
      current.status = "RECOMMENDED";
    });
    await refreshGap(true);
  } catch (error) {
    updateSlot(slotId, current => {
      current.status = previousStatus === "REMOVED" ? "REMOVED" : "RECOMMENDED";
    });
    errorText.value = error instanceof Error ? error.message : "替换失败";
  } finally {
    state.value.pageStatus = "MENU_READY";
  }
}

async function refreshGap(openPanel = false) {
  if (!activeSlots.value.length) {
    state.value.gap = createEmptyGapState();
    return;
  }
  if (!state.value.conditions.mealSlot || !state.value.conditions.peopleCount) return;
  const requestSeq = gapRequestSeq.value + 1;
  gapRequestSeq.value = requestSeq;
  state.value.pageStatus = "GAP_CHECKING";
  state.value.gap.loading = true;
  if (openPanel) {
    state.value.gap.visible = true;
  }

  try {
    const result = await randomMealApi.previewGap({
      mealSlot: state.value.conditions.mealSlot,
      peopleCount: state.value.conditions.peopleCount,
      items: activeSlots.value.map(item => ({
        slotId: item.slotId,
        slotType: item.slotType,
        recipeId: item.recipeId,
        recipeVersionId: item.recipeVersionId
      })),
      inventoryDecisions: []
    });
    if (requestSeq !== gapRequestSeq.value) return;
    state.value.gap = buildGapState(result);
    state.value.pageStatus = "MENU_READY";
  } catch (error) {
    if (requestSeq !== gapRequestSeq.value) return;
    state.value.gap.loading = false;
    errorText.value = error instanceof Error ? error.message : "缺口检查失败";
    state.value.pageStatus = "MENU_READY";
  }
}

function syncGapPreview() {
  if (!hasMenu.value || !activeSlots.value.length) {
    state.value.gap = createEmptyGapState();
    return;
  }
  void refreshGap(true);
}

async function openPlanSheet() {
  if (!ensureLoggedIn(() => {
    void openPlanSheet();
  })) return;
  if (state.value.gap.loading) return;
  if (!canCreatePlan.value || planSubmitting.value) return;
  planDate.value = todayText();
  selectedCategoryIds.value = {};
  categoryDraftName.value = "";
  showCategoryCreator.value = false;
  planSheetMounted.value = true;
  await uniPlatform.feedback.hideKeyboard();
  planSheetVisible.value = true;
  void loadPlanCategories();
}

function closePlanSheet() {
  if (planSubmitting.value) return;
  planSheetVisible.value = false;
}

function handlePlanSheetClose() {
  if (planSubmitting.value) return;
  closePlanSheet();
}

function forceClosePlanSheet() {
  planSheetVisible.value = false;
}

function handlePlanSheetAfterClose() {
  planSheetMounted.value = false;
}

function handlePlanDateChange(event: { detail?: { value?: string } }) {
  if (planSubmitting.value) return;
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  planDate.value = nextValue;
}

async function loadPlanCategories() {
  if (!inspirationSlots.value.length) return;
  categoryLoading.value = true;
  try {
    categories.value = await recipeApi.listCategories();
    selectedCategoryIds.value = inspirationSlots.value.reduce<Record<string, UUID | null>>((result, item) => {
      result[item.recipeVersionId] = null;
      return result;
    }, {});
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "分类加载失败", icon: "none" });
  } finally {
    categoryLoading.value = false;
  }
}

function selectCategory(recipeVersionId: UUID, categoryId: UUID | null) {
  selectedCategoryIds.value = { ...selectedCategoryIds.value, [recipeVersionId]: categoryId };
}

function toggleCategoryCreator() {
  showCategoryCreator.value = !showCategoryCreator.value;
  if (!showCategoryCreator.value) categoryDraftName.value = "";
}

async function createCategory() {
  const name = categoryDraftName.value.trim();
  if (!name || categorySubmitting.value) return;
  categorySubmitting.value = true;
  try {
    const created = await recipeApi.createCategory({ operationId: createOperationId(), name });
    categories.value = [...categories.value, created];
    for (const item of inspirationSlots.value) selectCategory(item.recipeVersionId, created.id);
    categoryDraftName.value = "";
    showCategoryCreator.value = false;
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建分类失败", icon: "none" });
  } finally {
    categorySubmitting.value = false;
  }
}

async function createPlan() {
  if (!ensureLoggedIn(() => {
    void createPlan();
  })) return;
  if (!state.value.conditions.mealSlot || !planReady.value || planSubmitting.value) return;
  planSubmitting.value = true;
  try {
    const plans = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const currentPlan = plans.items.find(item => item.mealSlot === state.value.conditions.mealSlot) ?? null;
    const existingItems = currentPlan?.menuItems ?? [];
    const randomItems = await buildPlanMenuItems();
    const existingMenuItems = existingItems
      .flatMap((item, index) => {
        if (!item.recipeId) return [];
        return [{
          slotType: item.slotType,
          sortOrder: index,
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId,
          purchaseState: item.purchaseState
        }];
      });
    const menuItemMap = new Map(existingMenuItems.map(item => [item.recipeVersionId, item]));
    for (const item of randomItems) {
      menuItemMap.set(item.recipeVersionId, item);
    }
    const menuItems = Array.from(menuItemMap.values()).map((item, index) => ({
      ...item,
      sortOrder: index
    }));
    const body: CreateMealPlanRequest = {
      operationId: createOperationId(),
      planDate: planDate.value,
      mealSlot: state.value.conditions.mealSlot,
      expectedVersion: currentPlan?.version ?? null,
      menuItems
    };
    await mealApi.createPlan(body);
    state.value.pageStatus = "COMPLETED";
    forceClosePlanSheet();
    await uniPlatform.feedback.toast({ title: "已加入计划", icon: "success" });
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入计划失败", icon: "none" });
  } finally {
    planSubmitting.value = false;
  }
}

async function buildPlanMenuItems(): Promise<RandomPlanMenuItemInput[]> {
  const shortageMap = new Map(
    state.value.gap.items.map(item => [item.slotId, item.missingIngredients.some(ingredient => ingredient.inventoryStatus !== "ENOUGH")])
  );
  const imported = new Map<UUID, { recipeId: UUID; recipeVersionId: UUID }>();
  for (const item of inspirationSlots.value) {
    const categoryId = selectedCategoryIds.value[item.recipeVersionId];
    if (!categoryId) throw new Error("请选择私房菜分类");
    const result = await recipeApi.createMyRecipeFromInspiration({
      operationId: createOperationId(),
      sourceRecipeId: item.recipeId,
      sourceVersionId: item.recipeVersionId,
      categoryId
    });
    imported.set(item.recipeVersionId, {
      recipeId: result.recipe.id,
      recipeVersionId: result.recipe.contentVersionId
    });
    if (categoryId) await uniPlatform.storage.set(APP_STORAGE_KEYS.randomMenuCategory, categoryId);
  }
  return activeSlots.value
    .slice()
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map(item => ({
      slotType: item.slotType,
      sortOrder: item.slotIndex,
      recipeId: imported.get(item.recipeVersionId)?.recipeId ?? item.recipeId,
      recipeVersionId: imported.get(item.recipeVersionId)?.recipeVersionId ?? item.recipeVersionId,
      purchaseState: shortageMap.get(item.slotId) ? "PENDING" : "READY"
    }));
}

function buildCurrentItems(targetSlotId: string) {
  return state.value.slots
    .filter(item => item.status !== "REMOVED" || item.slotId === targetSlotId)
    .map(toCurrentRandomItem);
}

function toCurrentRandomItem(item: RandomSlotViewModel) {
  return {
    slotId: item.slotId,
    slotType: item.slotType,
    sourceType: item.sourceType,
    recipeId: item.recipeId,
    recipeVersionId: item.recipeVersionId
  };
}

function buildSlotPlanForSlots(slots: RandomSlotViewModel[]): RandomSlotPlan {
  return {
    meatCount: slots.filter(item => item.slotType === "MEAT").length,
    vegetableCount: slots.filter(item => item.slotType === "VEGETABLE").length,
    soupCount: slots.filter(item => item.slotType === "SOUP").length,
    stapleCount: slots.filter(item => item.slotType === "STAPLE").length,
    breakfastStapleCount: slots.filter(item => item.slotType === "BREAKFAST_STAPLE").length,
    breakfastProteinCount: slots.filter(item => item.slotType === "BREAKFAST_PROTEIN").length,
    breakfastSideCount: slots.filter(item => item.slotType === "BREAKFAST_SIDE").length
  };
}

function mergeRerollSlots(
  lockedSlots: RandomSlotViewModel[],
  openSlots: RandomSlotViewModel[],
  generatedItems: RandomMenuItem[]
) {
  const generatedByType = new Map<RecipeSlotType, RandomMenuItem[]>();
  for (const item of generatedItems) {
    const bucket = generatedByType.get(item.slotType) ?? [];
    bucket.push(item);
    generatedByType.set(item.slotType, bucket);
  }
  const nextOpenSlots = openSlots.flatMap(slot => {
    const bucket = generatedByType.get(slot.slotType) ?? [];
    const generated = bucket.shift();
    if (!generated) return [];
    return [{
      ...createRandomSlotViewModel(generated),
      slotId: slot.slotId,
      slotIndex: slot.slotIndex
    }];
  });
  return [...lockedSlots, ...nextOpenSlots].sort((left, right) => left.slotIndex - right.slotIndex);
}

function uniqueIds(ids: UUID[]) {
  return Array.from(new Set(ids.filter(item => Number.isInteger(item) && item > 0)));
}

function markRejectedRecipeVersion(recipeVersionId: UUID) {
  rejectedRecipeVersionIds.value = uniqueIds([...rejectedRecipeVersionIds.value, recipeVersionId]);
}

function updateSlot(slotId: string, updater: (slot: RandomSlotViewModel) => void) {
  state.value.slots = state.value.slots.map(item => {
    if (item.slotId !== slotId) return item;
    const next = { ...item };
    updater(next);
    return next;
  });
}

function isSlotReplacing(slotId: string) {
  return state.value.slots.some(item => item.slotId === slotId && item.status === "REPLACING");
}

function handleRandomScroll(event: { detail?: { scrollTop?: number } }) {
  randomScrollTop.value = event.detail?.scrollTop ?? 0;
}

function buildDefaultSlotPlan(mealSlot: MealSlot | null, peopleCount: number | null): RandomSlotPlan | null {
  if (!mealSlot || !peopleCount) return null;
  if (mealSlot === "BREAKFAST") {
    return {
      meatCount: 0,
      vegetableCount: 0,
      soupCount: 0,
      stapleCount: 0,
      breakfastStapleCount: 1,
      breakfastProteinCount: 1,
      breakfastSideCount: 1
    };
  }
  const dishCount = peopleCount + 1;
  return {
    meatCount: Math.ceil(dishCount / 2),
    vegetableCount: Math.floor(dishCount / 2),
    soupCount: peopleCount >= 3 ? 1 : 0,
    stapleCount: 1,
    breakfastStapleCount: 0,
    breakfastProteinCount: 0,
    breakfastSideCount: 0
  };
}

function slotPlanTotal(slotPlan: RandomSlotPlan) {
  return (
    slotPlan.meatCount +
    slotPlan.vegetableCount +
    slotPlan.soupCount +
    slotPlan.stapleCount +
    slotPlan.breakfastStapleCount +
    slotPlan.breakfastProteinCount +
    slotPlan.breakfastSideCount
  );
}

function clampCount(value: number) {
  return Math.min(MAX_SLOT_TOTAL, Math.max(0, value));
}

function mealSlotLabel(value: MealSlot | null) {
  return formatMealSlot(value) || "未选择";
}

function peopleCountLabel(value: number | null) {
  if (value === null) return "未选人数";
  if (value <= 2) return "1-2人";
  if (value <= 4) return "3-4人";
  if (value <= 6) return "5-6人";
  return "7人以上";
}

function readRandomMenuConditionSnapshot(): RandomMenuConditionSnapshot {
  const snapshot = uniPlatform.storage.getSync<RandomMenuConditionSnapshot>(APP_STORAGE_KEYS.randomMenuConditions);
  return {
    mealSlot: parseMealSlot(snapshot?.mealSlot),
    peopleCount: parsePeopleCount(snapshot?.peopleCount),
    fridgePreferred: typeof snapshot?.fridgePreferred === "boolean" ? snapshot.fridgePreferred : undefined
  };
}

async function persistRandomMenuConditions() {
  await uniPlatform.storage.set(APP_STORAGE_KEYS.randomMenuConditions, {
    mealSlot: state.value.conditions.mealSlot,
    peopleCount: state.value.conditions.peopleCount,
    fridgePreferred: state.value.conditions.fridgePreferred
  } satisfies RandomMenuConditionSnapshot);
}

function resolveDefaultRandomMealSlot(): MealSlot {
  const now = new Date();
  const timeText = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const resolved = resolveMealSlotByTime(timeText);
  if (resolved === "BREAKFAST" || resolved === "LUNCH" || resolved === "DINNER") return resolved;
  return "DINNER";
}

function parseMealSlot(value: unknown): MealSlot | null {
  if (value === "BREAKFAST" || value === "LUNCH" || value === "DINNER") return value;
  return null;
}

function parsePeopleCount(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return null;
  return parsed;
}

function parseBoolean(value: unknown) {
  if (value === "1" || value === "true" || value === true) return true;
  if (value === "0" || value === "false" || value === false) return false;
  return null;
}

function ensureLoggedIn(action: () => void) {
  if (sessionStore.isLoggedIn) return true;
  loginModalStore.open(null, action);
  return false;
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  clearError();
  syncSlotPlan();
}

async function automatorApplySessionOnly(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
}

async function automatorClearSession() {
  loginModalStore.close();
  await sessionStore.clearSession();
}

function automatorPrimeConditions(next: { mealSlot?: MealSlot | null; peopleCount?: number | null; fridgePreferred?: boolean }) {
  if (typeof next.mealSlot !== "undefined") {
    state.value.conditions.mealSlot = next.mealSlot;
  }
  if (typeof next.peopleCount !== "undefined") {
    state.value.conditions.peopleCount = next.peopleCount;
  }
  if (typeof next.fridgePreferred !== "undefined") {
    state.value.conditions.fridgePreferred = next.fridgePreferred;
  }
  syncSlotPlan();
  clearMenuAndGap();
}

function automatorPrimeSlots(items: RandomMenuItem[]) {
  state.value.slots = items.map(createRandomSlotViewModel);
  state.value.gap = createEmptyGapState();
  state.value.pageStatus = items.length ? "MENU_READY" : "CONFIG_READY";
  errorText.value = "";
}

function automatorReadSlotCards() {
  return {
    hasMenu: hasMenu.value,
    cards: state.value.slots.map(item => ({
      slotType: item.slotType,
      title: item.title,
      recommendationReason: item.recommendationReason,
      sourceType: item.sourceType,
      fridgeFit: item.fridgeFit,
      durationText: item.durationText,
      servings: item.servings,
      mainProteinType: item.mainProteinType,
      matchedIngredients: item.matchedIngredients,
      flavorTags: item.flavorTags
    }))
  };
}

async function automatorTriggerGuestGenerate() {
  await generateMenu();
  return {
    loggedIn: sessionStore.isLoggedIn,
    loginVisible: loginModalStore.visible
  };
}

function automatorTriggerGuestToggleFridge() {
  toggleFridgePreferred();
  return {
    loggedIn: sessionStore.isLoggedIn,
    loginVisible: loginModalStore.visible,
    fridgePreferred: state.value.conditions.fridgePreferred
  };
}

function automatorReadThemeState() {
  return {
    themeMode: themeMode.value,
    effectiveSkin: effectiveSkin.value,
    effectivePalette: effectivePalette.value,
    canSwitchPalette: canSwitchPalette.value,
    currentThemeText: currentThemeText.value,
    themePageStyle: themePageStyle.value,
    colorPage: themeVars.value["--color-page"] ?? ""
  };
}

async function automatorResetThemeSettings() {
  await settingsStore.clearSettings();
  return automatorReadThemeState();
}

async function automatorApplyThemeSettings(snapshot: {
  themeMode?: ThemeMode;
  themeSkin?: ThemeSkin;
  themePalette?: ThemePalette;
}) {
  if (snapshot.themeMode) {
    await settingsStore.setThemeMode(snapshot.themeMode);
  }
  if (snapshot.themeSkin) {
    await settingsStore.setThemeSkin(snapshot.themeSkin);
  }
  if (snapshot.themePalette) {
    await settingsStore.setThemePalette(snapshot.themePalette);
  }
  return automatorReadThemeState();
}

defineExpose({
  automatorApplySession,
  automatorApplySessionOnly,
  automatorClearSession,
  automatorPrimeConditions,
  automatorPrimeSlots,
  automatorReadSlotCards,
  automatorTriggerGuestGenerate,
  automatorTriggerGuestToggleFridge,
  automatorReadThemeState,
  automatorResetThemeSettings,
  automatorApplyThemeSettings
});
</script>

<style scoped lang="scss">
.random-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
  transition: opacity 180ms ease;
}

.random-scroll {
  height: 100%;
  background: var(--color-page);
}

.random-page {
  min-height: 100%;
  padding-bottom: calc(288rpx + env(safe-area-inset-bottom));
}

.random-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background: var(--page-hero-halo-bg);
}

.random-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.random-hero__eyebrow,
.random-hero__title,
.random-hero__description,
.board-card__eyebrow,
.board-card__title,
.board-card__description,
.notice__text,
.notice__action {
  display: block;
}

.random-hero__eyebrow,
.board-card__eyebrow {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.random-hero__title,
.board-card__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.random-hero__description,
.board-card__description {
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.notice,
.board-card {
  margin-top: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 22rpx 24rpx;
}

.notice__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.notice__action {
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.board-card {
  padding: var(--space-md);
  background: var(--material-card-accent-bg);
}

.board-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.board-card__badge {
  flex: 0 0 auto;
  padding: 10rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.board-card__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.board-card__summary-item {
  padding: 10rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-mask-weak);
  color: var(--color-text);
  font-size: var(--font-size-xs);
}

.random-generate-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 820;
  padding: 20rpx var(--space-page) calc(20rpx + env(safe-area-inset-bottom));
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
}

.random-generate-bar__buttons {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.random-generate-bar__quota {
  display: block;
  margin-bottom: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-align: center;
}

.random-generate-bar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  margin: 0;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1;
  box-sizing: border-box;
}

.random-generate-bar__button::after {
  border: none;
}

.random-generate-bar__button--primary {
  width: 100%;
  flex: 1 1 100%;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.plan-sheet {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.plan-sheet__summary,
.plan-sheet__footer {
  display: flex;
}

.plan-sheet__summary {
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.plan-sheet__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.plan-sheet__value,
.plan-sheet__picker {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.plan-sheet__tips {
  padding: 18rpx 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-state-warning-soft);
}

.plan-sheet__tips-text {
  display: block;
  color: var(--color-state-warning-text);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.plan-sheet__inspiration {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--material-card-accent-bg);
}

.plan-sheet__section-head,
.plan-sheet__category-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
}

.plan-sheet__section-head {
  align-items: flex-start;
}

.plan-sheet__section-title,
.plan-sheet__category-title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.plan-sheet__section-note {
  display: block;
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.plan-sheet__category-action {
  flex: 0 0 auto;
  color: var(--color-support-action);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.plan-sheet__creator {
  display: flex;
  gap: 12rpx;
}

.plan-sheet__creator-input {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-md);
  background: var(--material-input-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.plan-sheet__creator-button {
  flex: 0 0 104rpx;
  height: 68rpx;
  margin: 0;
  border-radius: var(--radius-md);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: var(--font-size-xs);
}

.plan-sheet__category-row {
  flex-direction: column;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--material-card-border);
}

.plan-sheet__category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.plan-sheet__category-chip {
  min-height: 50rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-pill);
  background: var(--material-input-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 50rpx;
}

.plan-sheet__category-chip--active {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.plan-sheet__footer {
  gap: 16rpx;
}

.plan-sheet__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
