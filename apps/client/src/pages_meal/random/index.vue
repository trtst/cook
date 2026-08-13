<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="随机一下" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="random-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="random-scroll" scroll-y :show-scrollbar="false" @scroll="handleRandomScroll">
      <view class="random-page">
        <view class="random-hero" :style="heroStyle">
          <text class="random-hero__eyebrow">帮我决定</text>
          <text class="random-hero__title">{{ heroTitle }}</text>
          <text class="random-hero__description">{{ heroDescription }}</text>
        </view>

        <view class="random-content">
          <Login
            v-if="!sessionStore.isLoggedIn"
            title="登录后随机一桌"
            description="先选早餐、午餐或晚餐，再围绕这一桌菜做保留、换菜和缺口确认。"
          />

          <template v-else>
            <view v-if="errorText" class="notice" @click="clearError">
              <text class="notice__text">{{ errorText }}</text>
              <text class="notice__action">知道了</text>
            </view>

            <RandomConditionBar
              :meal-slot="state.conditions.mealSlot"
              :people-count="state.conditions.peopleCount"
              :fridge-preferred="state.conditions.fridgePreferred"
              :slot-plan="state.slotPlan"
              :has-menu="hasMenu"
              :loading="conditionLoading"
              :generate-disabled="generateDisabled"
              @select-meal-slot="selectMealSlot"
              @select-people-count="selectPeopleCount"
              @toggle-fridge-preferred="toggleFridgePreferred"
              @adjust-slot-plan="adjustSlotPlan"
              @generate="generateMenu"
              @reroll="rerollMenu"
            />

            <view v-if="warnings.length" class="warning-card">
              <view v-for="warning in warnings" :key="warning.code + warning.message" class="warning-card__item">
                <text class="warning-card__title">{{ warning.message }}</text>
                <text class="warning-card__desc">当前条件下能选的菜不多，已按现有菜谱尽量推荐。</text>
              </view>
            </view>

            <view v-if="!hasMenu" class="empty-card">
              <Empty
                title="先定这一顿再开始"
                description="先选餐次、人数和冰箱优先，再生成一桌可执行菜单。"
              />
            </view>

            <template v-else>
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
                  <text class="board-card__summary-item">已保留 {{ lockedCount }} 道</text>
                  <text class="board-card__summary-item">已划掉 {{ removedCount }} 道</text>
                  <text class="board-card__summary-item">待处理 {{ activeSlots.length }} 道</text>
                </view>

                <view class="slot-list">
                  <RandomSlotCard
                    v-for="slot in state.slots"
                    :key="slot.slotId"
                    :slot="slot"
                    :disabled="slotActionLocked"
                    @lock="lockSlot"
                    @unlock="unlockSlot"
                    @remove="removeSlot"
                    @replace="replaceSlot"
                    @toggle-constraint="toggleConstraint"
                  />
                </view>
              </view>

              <RandomGapPanel
                v-if="state.gap.visible"
                :items="state.gap.items"
                :summary="state.gap.summary"
                :loading="state.gap.loading"
                @update-decision="updateGapDecision"
                @remove-slot="removeSlotFromGap"
                @replace-slot="replaceSlotFromGap"
                @keep-pending="keepPending"
                @buy-slot="markBuyGap"
              />

              <RandomBottomBar
                :title="bottomTitle"
                :description="bottomDescription"
                :loading="conditionLoading"
                :show-gap-button="!state.gap.visible"
                :show-plan-button="state.gap.visible"
                :show-shopping-button="state.gap.visible && state.gap.items.length > 0"
                :plan-disabled="!canCreatePlan"
                :shopping-disabled="!canCreateShopping"
                @open-gap="openGap"
                @create-plan="openPlanSheet"
                @create-shopping="createShopping"
              />
            </template>
          </template>
        </view>
      </view>
    </scroll-view>

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
          <text class="plan-sheet__tips-text">保留但暂不采购的菜位会写入计划，并带 `待采购` 状态。</text>
        </view>
      </view>

      <template #footer>
        <view class="plan-sheet__footer">
          <button class="secondary plan-sheet__button" @click="closePlanSheet">取消</button>
          <button class="primary plan-sheet__button" :disabled="planSubmitting" @click="createPlan">
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
import { recipeApi } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { mealApi, type CreateMealPlanRequest } from "../apis/meal";
import {
  randomMealApi,
  type CheckRandomMenuGapResponse,
  type MealSlot,
  type RandomGapDecision,
  type RandomGapSummary,
  type RandomMenuWarning,
  type RandomReplaceConstraintKind,
  type RandomSlotPlan,
  type RecipeSlotType
} from "../apis/random";
import RandomBottomBar from "../components/RandomBottomBar.vue";
import RandomConditionBar from "../components/RandomConditionBar.vue";
import RandomGapPanel from "../components/RandomGapPanel.vue";
import RandomSlotCard from "../components/RandomSlotCard.vue";
import { todayText } from "../utils/date";
import {
  buildGapState,
  createEmptyGapState,
  createRandomSlotViewModel,
  toGapDecisionItems,
  type RandomGapAction,
  type RandomGapItemViewModel,
  type RandomPageState,
  type RandomPlanMenuItemInput,
  type RandomSlotViewModel
} from "../types/random";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();

const RANDOM_NAV_GAP = 16;
const RANDOM_NAV_FADE_DISTANCE = 96;
const MAX_SLOT_TOTAL = 12;

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
const warnings = ref<RandomMenuWarning[]>([]);
const errorText = ref("");
const randomScrollTop = ref(0);
const pageMutating = ref(false);
const gapRequestSeq = ref(0);
const planSheetMounted = ref(false);
const planSheetVisible = ref(false);
const planDate = ref(todayText());
const planSubmitting = ref(false);
const shoppingSubmitting = ref(false);

const hasMenu = computed(() => state.value.slots.length > 0);
const activeSlots = computed(() => state.value.slots.filter(item => item.status !== "REMOVED"));
const lockedCount = computed(() => state.value.slots.filter(item => item.status === "LOCKED").length);
const removedCount = computed(() => state.value.slots.filter(item => item.status === "REMOVED").length);
const generateDisabled = computed(() => !state.value.conditions.mealSlot || !state.value.conditions.peopleCount);
const submitLoading = computed(() => planSubmitting.value || shoppingSubmitting.value);
const conditionLoading = computed(() => pageMutating.value || state.value.gap.loading || submitLoading.value);
const slotActionLocked = computed(() => pageMutating.value || state.value.gap.loading || submitLoading.value);
const canCreateShopping = computed(() => state.value.gap.items.some(item => item.action === "BUY"));
const canCreatePlan = computed(() => {
  if (!state.value.gap.visible || !activeSlots.value.length) return false;
  return state.value.gap.items.every(item => {
    if (!item.missingIngredients.length) return true;
    return item.action === "BUY" || item.action === "KEEP_PENDING";
  });
});

const heroTitle = computed(() => {
  if (!state.value.conditions.mealSlot) return "这一顿吃什么，先定早餐、午餐还是晚餐";
  if (!hasMenu.value) return "先生成一桌，再逐道决定保留还是换掉";
  return "先围着这一桌做决定，不用整桌全收或整桌推翻";
});

const heroDescription = computed(() => {
  if (!state.value.conditions.mealSlot) return "这页不再默认“今晚”。先选餐次、人数和是否优先清冰箱，再给你一桌可执行菜单。";
  if (!hasMenu.value) return "随机页不是三套候选对比，而是一桌可拆解菜单：满意就保留，不满意就换一道。";
  return "先把这桌能不能做、缺什么、哪些先不买处理清楚，再决定要不要写进计划。";
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

const boardDescription = computed(() => {
  if (!warnings.value.length) return "每道菜都可以单独保留、划掉或换一道；替换约束只作用于当前菜位。";
  return "当前条件下可选菜不多，先按现有菜谱尽量搭出一桌；你也可以继续换菜或手动减位。";
});

const bottomTitle = computed(() => {
  if (!state.value.gap.visible) return "先看看这桌现在缺什么";
  if (canCreatePlan.value) return "这桌已经可以进入下一步";
  return "先把库存未确认和缺料处理完，再决定计划或采购";
});

const bottomDescription = computed(() => {
  if (!state.value.gap.visible) return "缺口预检只检查当前这桌，不混用全局缺口。";
  if (canCreateShopping.value && !canCreatePlan.value) return "把准备采购的菜位标出来，再去购物清单处理。";
  if (canCreatePlan.value) return "去采购的菜位继续缺口采购，保留待采购的菜位会写入计划但标记为待采购。";
  return "库存未确认的食材需要先确认有/无；缺料菜位也要明确是去采购还是保留待采购。";
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

  if (mealSlot) {
    state.value.conditions.mealSlot = mealSlot;
  }
  if (peopleCount) {
    state.value.conditions.peopleCount = peopleCount;
  }
  if (fridgePreferred !== null) {
    state.value.conditions.fridgePreferred = fridgePreferred;
  }

  syncSlotPlan();
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  syncSlotPlan();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      resetRandomState();
      return;
    }
    syncSlotPlan();
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
  warnings.value = [];
  errorText.value = "";
}

function clearError() {
  errorText.value = "";
}

function syncSlotPlan() {
  state.value.slotPlan = buildDefaultSlotPlan(state.value.conditions.mealSlot, state.value.conditions.peopleCount);
}

function selectMealSlot(value: MealSlot) {
  if (conditionLoading.value) return;
  state.value.conditions.mealSlot = value;
  clearMenuAndGap();
}

function selectPeopleCount(value: number) {
  if (conditionLoading.value) return;
  state.value.conditions.peopleCount = value;
  clearMenuAndGap();
}

function toggleFridgePreferred() {
  if (conditionLoading.value) return;
  state.value.conditions.fridgePreferred = !state.value.conditions.fridgePreferred;
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
  warnings.value = [];
  errorText.value = "";
  if (sessionStore.isLoggedIn) {
    state.value.pageStatus = generateDisabled.value ? "IDLE" : "CONFIG_READY";
  }
}

async function generateMenu() {
  if (generateDisabled.value || !state.value.conditions.mealSlot || !state.value.conditions.peopleCount || !state.value.slotPlan || pageMutating.value) return;
  pageMutating.value = true;
  state.value.pageStatus = "MENU_MUTATING";
  errorText.value = "";
  try {
    const result = await randomMealApi.generateMenu({
      mealSlot: state.value.conditions.mealSlot,
      peopleCount: state.value.conditions.peopleCount,
      fridgePreferred: state.value.conditions.fridgePreferred,
      slotPlan: state.value.slotPlan
    });
    state.value.slotPlan = result.slotPlan;
    state.value.slots = result.items.map(createRandomSlotViewModel);
    state.value.gap = createEmptyGapState();
    warnings.value = result.warnings;
    state.value.pageStatus = "MENU_READY";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "生成失败";
    state.value.pageStatus = hasMenu.value ? "MENU_READY" : "CONFIG_READY";
  } finally {
    pageMutating.value = false;
  }
}

async function rerollMenu() {
  if (!hasMenu.value || pageMutating.value) return;
  const replaceTargets = state.value.slots.filter(item => item.status !== "LOCKED");
  if (!replaceTargets.length) {
    await uniPlatform.feedback.toast({ title: "这桌已经全部保留了", icon: "none" });
    return;
  }
  pageMutating.value = true;
  state.value.pageStatus = "MENU_MUTATING";
  errorText.value = "";
  try {
    for (const item of replaceTargets) {
      await replaceSlot(item.slotId, true);
    }
    state.value.gap = createEmptyGapState();
    state.value.pageStatus = "MENU_READY";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "重摇失败";
    state.value.pageStatus = "MENU_READY";
  } finally {
    pageMutating.value = false;
  }
}

function lockSlot(slotId: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  updateSlot(slotId, slot => {
    slot.status = "LOCKED";
  });
}

function unlockSlot(slotId: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  updateSlot(slotId, slot => {
    if (slot.status === "LOCKED") {
      slot.status = "RECOMMENDED";
    }
  });
}

function removeSlot(slotId: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  updateSlot(slotId, slot => {
    slot.status = "REMOVED";
    slot.gapAction = "REMOVE";
  });
  removeGapSlot(slotId);
}

async function replaceSlot(slotId: string, fromBatch = false) {
  if (!fromBatch && (state.value.gap.loading || submitLoading.value)) return;
  const slot = state.value.slots.find(item => item.slotId === slotId);
  if (!slot || slot.status === "REPLACING" || !state.value.conditions.mealSlot || !state.value.conditions.peopleCount || !state.value.slotPlan) return;

  const previousStatus = slot.status;
  const requestSeq = slot.requestSeq + 1;
  updateSlot(slotId, current => {
    current.requestSeq = requestSeq;
    current.status = "REPLACING";
  });
  if (!fromBatch) {
    state.value.pageStatus = "MENU_MUTATING";
  }
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
      rejectedRecipeVersionIds: [slot.recipeVersionId],
      requestSeq
    });

    if (result.requestSeq !== requestSeq) return;

    if (!result.slot) {
      updateSlot(slotId, current => {
        current.status = previousStatus === "REMOVED" ? "REMOVED" : previousStatus === "LOCKED" ? "LOCKED" : "RECOMMENDED";
      });
      if (result.warning) {
        warnings.value = [result.warning];
      }
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
      current.latestAppliedSeq = requestSeq;
      current.status = previousStatus === "LOCKED" ? "LOCKED" : "RECOMMENDED";
      current.gapAction = null;
    });
    warnings.value = result.warning ? [result.warning] : [];
    removeGapSlot(slotId);
  } catch (error) {
    updateSlot(slotId, current => {
      current.status = previousStatus === "REMOVED" ? "REMOVED" : previousStatus === "LOCKED" ? "LOCKED" : "RECOMMENDED";
    });
    errorText.value = error instanceof Error ? error.message : "替换失败";
  } finally {
    if (!fromBatch) {
      state.value.pageStatus = "MENU_READY";
    }
  }
}

function toggleConstraint(slotId: string, kind: RandomReplaceConstraintKind, value: string) {
  if (slotActionLocked.value) return;
  if (isSlotReplacing(slotId)) return;
  updateSlot(slotId, slot => {
    const exists = slot.replaceConstraints.some(item => item.kind === kind && item.value === value);
    const remaining = slot.replaceConstraints.filter(item => item.kind !== kind);
    slot.replaceConstraints = exists ? remaining : [...remaining, { kind, value }];
  });
}

async function openGap() {
  if (conditionLoading.value) return;
  if (!activeSlots.value.length || !state.value.conditions.mealSlot || !state.value.conditions.peopleCount) return;
  await refreshGap(true);
}

async function refreshGap(openPanel = false) {
  if (!state.value.conditions.mealSlot || !state.value.conditions.peopleCount) return;
  const requestSeq = gapRequestSeq.value + 1;
  gapRequestSeq.value = requestSeq;
  state.value.pageStatus = "GAP_CHECKING";
  state.value.gap.loading = true;
  errorText.value = "";
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
      inventoryDecisions: toGapDecisionItems(state.value.gap.items)
    });
    if (requestSeq !== gapRequestSeq.value) return;
    const nextGap = buildGapState(result);
    const actionMap = new Map(state.value.gap.items.map(item => [item.slotId, item.action]));
    const decisionMap = new Map(
      state.value.gap.items.flatMap(item =>
        item.decisions.map(decision => [`${item.slotId}:${decision.decisionKey}`, decision.decision] as const)
      )
    );
    nextGap.items = nextGap.items.map(item => ({
      ...item,
      action: actionMap.get(item.slotId) ?? null,
      decisions: item.decisions.map(decision => ({
        ...decision,
        decision: decisionMap.get(`${item.slotId}:${decision.decisionKey}`) ?? decision.decision
      }))
    }));
    state.value.gap = nextGap;
    state.value.pageStatus = "MENU_READY";
  } catch (error) {
    if (requestSeq !== gapRequestSeq.value) return;
    state.value.gap.loading = false;
    errorText.value = error instanceof Error ? error.message : "缺口检查失败";
    state.value.pageStatus = "MENU_READY";
  }
}

async function updateGapDecision(slotId: string, decisionKey: string, decision: RandomGapDecision) {
  if (state.value.gap.loading || submitLoading.value) return;
  if (isSlotReplacing(slotId)) return;
  const item = state.value.gap.items.find(current => current.slotId === slotId);
  if (!item) return;
  item.decisions = item.decisions.map(current => (current.decisionKey === decisionKey ? { ...current, decision } : current));
  await refreshGap(true);
}

function keepPending(slotId: string) {
  if (state.value.gap.loading || submitLoading.value) return;
  updateGapAction(slotId, "KEEP_PENDING");
}

function markBuyGap(slotId: string) {
  if (state.value.gap.loading || submitLoading.value) return;
  updateGapAction(slotId, "BUY");
}

function removeSlotFromGap(slotId: string) {
  if (state.value.gap.loading || submitLoading.value) return;
  removeSlot(slotId);
}

async function replaceSlotFromGap(slotId: string) {
  if (state.value.gap.loading || submitLoading.value) return;
  await replaceSlot(slotId);
  await refreshGap(true);
}

function updateGapAction(slotId: string, action: RandomGapAction) {
  if (isSlotReplacing(slotId)) return;
  state.value.gap.items = state.value.gap.items.map(item => (item.slotId === slotId ? { ...item, action } : item));
  updateSlot(slotId, slot => {
    slot.gapAction = action;
  });
}

function removeGapSlot(slotId: string) {
  if (!state.value.gap.visible) return;
  state.value.gap.items = state.value.gap.items.filter(item => item.slotId !== slotId);
  if (!state.value.gap.items.length) {
    state.value.gap = activeSlots.value.length
      ? {
          visible: true,
          loading: false,
          items: [],
          summary: createZeroGapSummary(),
          canCreatePlan: true
        }
      : createEmptyGapState();
    state.value.pageStatus = "MENU_READY";
    return;
  }
  state.value.gap.summary = summarizeGapItems(state.value.gap.items);
}

async function openPlanSheet() {
  if (state.value.gap.loading) return;
  if (!canCreatePlan.value || planSubmitting.value) return;
  planDate.value = todayText();
  planSheetMounted.value = true;
  await uniPlatform.feedback.hideKeyboard();
  planSheetVisible.value = true;
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

async function createPlan() {
  if (!state.value.conditions.mealSlot || !canCreatePlan.value || planSubmitting.value) return;
  planSubmitting.value = true;
  try {
    const plans = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const currentPlan = plans.items.find(item => item.mealSlot === state.value.conditions.mealSlot) ?? null;
    const existingItems = currentPlan?.menuItems ?? [];
    const randomItems = buildPlanMenuItems();
    const recipeIds = [...existingItems.map(item => item.recipeId), ...randomItems.map(item => item.recipeId)].filter(
      (item, index, list): item is UUID => Boolean(item) && list.indexOf(item) === index
    );
    const recipes = await Promise.all(recipeIds.map(recipeId => recipeApi.getMyRecipe(recipeId)));
    const recipeMap = new Map(recipes.map(recipe => [recipe.id, recipe]));
    const randomItemMap = new Map(randomItems.map(item => [item.recipeId, item]));
    const menuItems = recipeIds.map((recipeId, index) => {
      const recipe = recipeMap.get(recipeId);
      const existing = existingItems.find(item => item.recipeId === recipeId) ?? null;
      const random = randomItemMap.get(recipeId) ?? null;
      if (!recipe) return null;
      return {
        slotType: random?.slotType ?? existing?.slotType ?? null,
        sortOrder: index,
        recipeId: recipe.id,
        recipeVersionId: recipe.contentVersionId,
        purchaseState:
          random?.purchaseState === "PENDING" || existing?.purchaseState === "PENDING"
            ? ("PENDING" as const)
            : ("READY" as const)
      };
    });
    if (menuItems.some(item => item === null)) {
      await uniPlatform.feedback.toast({ title: "当前计划包含已变化的菜谱，请刷新后重试", icon: "none" });
      return;
    }
    const body: CreateMealPlanRequest = {
      operationId: createOperationId(),
      planDate: planDate.value,
      mealSlot: state.value.conditions.mealSlot,
      expectedVersion: currentPlan?.version ?? null,
      menuItems: menuItems.filter((item): item is NonNullable<typeof item> => Boolean(item))
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

async function createShopping() {
  if (state.value.gap.loading) return;
  if (!canCreateShopping.value || shoppingSubmitting.value) return;
  shoppingSubmitting.value = true;
  try {
    await randomMealApi.createShoppingItems({
      operationId: createOperationId(),
      items: state.value.gap.items
        .filter(item => item.action === "BUY")
        .map(item => ({
          slotId: item.slotId,
          recipeId: item.recipeId,
          recipeVersionId: item.recipeVersionId,
          ingredients: item.missingIngredients
            .filter(ingredient => ingredient.inventoryStatus !== "UNKNOWN")
            .map(ingredient => ({
              ingredientId: ingredient.ingredientId,
              ingredientName: ingredient.ingredientName,
              quantityText: ingredient.quantityText
            }))
        }))
    });
    state.value.pageStatus = "COMPLETED";
    await uniPlatform.feedback.toast({ title: "已加入购物清单", icon: "success" });
    void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入购物清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

function buildPlanMenuItems(): RandomPlanMenuItemInput[] {
  const actionMap = new Map(state.value.gap.items.map(item => [item.slotId, item.action]));
  return activeSlots.value
    .slice()
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map(item => ({
      slotType: item.slotType,
      sortOrder: item.slotIndex,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId,
      purchaseState: actionMap.get(item.slotId) === "KEEP_PENDING" ? "PENDING" : "READY"
    }));
}

function buildCurrentItems(targetSlotId: string) {
  return state.value.slots
    .filter(item => item.status !== "REMOVED" || item.slotId === targetSlotId)
    .map(item => ({
      slotId: item.slotId,
      slotType: item.slotType,
      recipeId: item.recipeId,
      recipeVersionId: item.recipeVersionId
    }));
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

function summarizeGapItems(items: RandomGapItemViewModel[]): RandomGapSummary {
  return items.reduce<RandomGapSummary>(
    (summary, item) => {
      switch (item.status) {
        case "OK":
          summary.okCount += 1;
          break;
        case "PARTIAL":
          summary.partialCount += 1;
          break;
        case "MISSING":
          summary.missingCount += 1;
          break;
        case "UNKNOWN":
          summary.unknownCount += 1;
          break;
      }
      return summary;
    },
    {
      okCount: 0,
      partialCount: 0,
      missingCount: 0,
      unknownCount: 0
    }
  );
}

function createZeroGapSummary(): RandomGapSummary {
  return {
    okCount: 0,
    partialCount: 0,
    missingCount: 0,
    unknownCount: 0
  };
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
    soupCount: 1,
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
  switch (value) {
    case "BREAKFAST":
      return "早餐";
    case "LUNCH":
      return "午餐";
    case "DINNER":
      return "晚餐";
    default:
      return "未选择";
  }
}

function peopleCountLabel(value: number | null) {
  if (value === null) return "未选人数";
  if (value <= 2) return "1-2人";
  if (value <= 4) return "3-4人";
  if (value <= 6) return "5-6人";
  return "7人以上";
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
</script>

<style scoped lang="scss">
.random-nav-backdrop {
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

.random-scroll {
  height: 100%;
  background: var(--color-page);
}

.random-page {
  min-height: 100%;
  padding-bottom: calc(220rpx + env(safe-area-inset-bottom));
}

.random-hero {
  padding: 64rpx var(--space-page) 164rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, rgba(168, 224, 255, 0.42), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(206, 230, 255, 0.38), transparent 28%),
    linear-gradient(145deg, rgba(234, 247, 255, 0.96), rgba(250, 252, 255, 0.98));
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
.warning-card__title,
.warning-card__desc,
.notice__text,
.notice__action {
  display: block;
}

.random-hero__eyebrow,
.board-card__eyebrow {
  color: var(--color-primary);
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
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.notice,
.warning-card,
.empty-card,
.board-card {
  margin-top: var(--space-md);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
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
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.warning-card {
  padding: 22rpx 24rpx;
}

.warning-card__item + .warning-card__item {
  margin-top: 14rpx;
}

.warning-card__title {
  color: #8b4d12;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.warning-card__desc {
  margin-top: 6rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.empty-card {
  padding: 18rpx;
}

.board-card {
  padding: var(--space-md);
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
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
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
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
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
  background: rgba(255, 220, 168, 0.18);
}

.plan-sheet__tips-text {
  display: block;
  color: #8b4d12;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
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
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
