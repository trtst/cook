<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="美食计划" full-screen>
    <view class="plan-page">
        <view class="plan-fixed-head">
          <view class="month-bar">
            <view class="month-bar__arrow" hover-class="month-bar__arrow--hover" hover-stay-time="100" @click="goMonth(-1)">
              <text class="cookfont icon-back month-bar__arrow-icon" />
            </view>
            <text class="month-bar__title">{{ monthTitle }}</text>
            <view
              class="month-bar__arrow month-bar__arrow--right"
              hover-class="month-bar__arrow--hover"
              hover-stay-time="100"
              @click="goMonth(1)"
            >
              <text class="cookfont icon-back month-bar__arrow-icon month-bar__arrow-icon--right" />
            </view>
          </view>

          <swiper
            class="week-swiper"
            :current="weekSwiperCurrent"
            :duration="weekSwiperDuration"
            :disable-touch="Boolean(monthTransition) || weekSilentReset"
            @change="handleWeekSwiperChange"
          >
            <swiper-item v-for="panel in weekPanels" :key="panel.key">
              <view class="week-row">
                <view
                  v-for="day in panel.days"
                  :key="day.date"
                  :class="['week-day', day.isSelected ? 'week-day--selected' : '', day.isToday ? 'week-day--today' : '']"
                  hover-class="week-day--hover"
                  hover-stay-time="100"
                  @click="selectDate(day.date)"
                >
                  <text class="week-day__label">{{ day.label }}</text>
                  <view class="week-day__number-shell">
                    <text class="week-day__number">{{ day.dayNumber }}</text>
                  </view>
                  <view class="week-day__dots">
                    <view v-if="day.mark.breakfast" class="week-day__dot week-day__dot--breakfast" />
                    <view v-if="day.mark.lunch" class="week-day__dot week-day__dot--lunch" />
                    <view v-if="day.mark.afternoonTea" class="week-day__dot week-day__dot--afternoon-tea" />
                    <view v-if="day.mark.dinner" class="week-day__dot week-day__dot--dinner" />
                    <view v-if="day.mark.lateNight" class="week-day__dot week-day__dot--late-night" />
                  </view>
                </view>
              </view>
            </swiper-item>
          </swiper>
        </view>

        <view class="plan-scroll-wrap">
          <view class="day-head">
            <text class="day-head__title">{{ selectedDateTitle }}</text>
            <text class="day-head__subtitle">{{ selectedDateHint }}</text>
          </view>

          <view class="plan-scroll-area">
            <RecipeSearchLoading
              :pull-distance="pullDistance"
              :refreshing="refreshing"
              :show-success="showSuccess"
              :refresher-text="refresherText"
              :threshold="refresherThreshold"
              :loading="inlineLoading"
              :loading-text="inlineLoadingText"
            />

            <scroll-view
              scroll-y
              class="plan-scroll"
              refresher-enabled
              refresher-default-style="none"
              :show-scrollbar="false"
              :refresher-threshold="refresherThreshold"
              :refresher-triggered="refresherTriggered"
              @refresherpulling="onRefresherPulling"
              @refresherrefresh="handleRefresherRefresh"
              @refresherrestore="onRefresherRestore"
              @refresherabort="onRefresherRestore"
            >
              <view class="plan-scroll__body">
                <LoginEmptyState
                  v-if="!sessionStore.isLoggedIn"
                  :art="emptyStateArt"
                  title="登录后查看这一天的安排"
                  description="顶部日历会继续保留；登录后再看这一天具体吃什么、要不要继续发起饭局。"
                />

                <template v-else>
                  <view v-if="loading && !refreshing" class="notice">正在同步这一周的计划...</view>

                  <view v-if="!selectedPlanCount && !loading">
                    <Empty
                      :art="emptyStateArt"
                      title="这一天还没有安排"
                      description="先把想吃的记下来，复制上周还是去菜谱挑一道，都能从右下角继续。"
                    />
                  </view>

                  <view v-if="selectedPlanCount" class="meal-list">
                  <view
                    v-for="plan in selectedPlans"
                    :key="plan.id"
                    :class="['meal-card', `meal-card--${slotTone(plan.mealSlot)}`, plan.hasDiningEvent ? 'meal-card--has-event' : '']"
                    hover-class="meal-card--hover"
                    hover-stay-time="100"
                    @click="openPlanDetail(plan)"
                  >
                    <text v-if="plan.hasDiningEvent" class="meal-card__event-badge">
                      {{ planDiningText(plan) }}
                    </text>

                    <view class="meal-card__panel">
                      <view class="meal-card__title-row">
                        <view class="meal-card__head-main">
                          <view class="meal-card__title-main">
                            <text class="meal-card__title">{{ planCardTitle(plan) }}</text>
                            <text class="meal-card__slot">{{ slotLabel(plan.mealSlot) }}</text>
                          </view>
                          <view class="meal-card__meta">
                            <text class="meal-card__meta-text">{{ planDishCountText(plan) }}</text>
                            <text v-if="planDurationText(plan)" class="meal-card__meta-divider">·</text>
                            <text v-if="planDurationText(plan)" class="meal-card__meta-text">{{ planDurationText(plan) }}</text>
                          </view>
                        </view>
                        <text v-if="planCardStateText(plan)" class="meal-card__state">{{ planCardStateText(plan) }}</text>
                      </view>

                      <view class="meal-card__menu-list">
                        <view
                          v-for="(item, index) in visibleMenuItems(plan)"
                          :key="`${item.recipeVersionId}-${item.sortOrder}-${index}`"
                          class="meal-card__menu-row"
                        >
                          <text class="meal-card__menu-name">{{ item.title }}</text>
                          <view v-if="item.servings" class="meal-card__menu-dash" />
                          <text v-if="item.servings" class="meal-card__menu-servings">{{ item.servings }}人份</text>
                        </view>
                        <view v-if="hasMoreMenuItems(plan)" class="meal-card__menu-row meal-card__menu-row--more">
                          <text class="meal-card__menu-more">...</text>
                        </view>
                      </view>

                      <view v-if="canShowShoppingAction(plan)" class="meal-card__footer">
                        <view class="meal-card__actions">
                          <button
                            class="action-pill action-pill--primary meal-card__action-button"
                            :class="{ 'meal-card__action-button--disabled': shoppingSubmitting && shoppingPlan?.id === plan.id && !hasShoppingListLink(plan) }"
                            @click.stop="handlePlanShoppingAction(plan)"
                          >
                            {{ planShoppingActionText(plan) }}
                          </button>
                        </view>
                      </view>
                    </view>
                  </view>
                  </view>
                </template>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>

      <view v-if="canShowPlanDock" class="floating-dock">
        <view v-if="emptyDockOpen" class="floating-dock__backdrop" @click="closeEmptyDock" />
        <view class="manage-dock">
          <view class="manage-dock__actions">
            <view
              v-for="(action, index) in planDockActions"
              :key="action.key"
              class="manage-dock__action"
              :class="{
                'manage-dock__action--open': emptyDockOpen,
                'manage-dock__action--disabled': action.key === 'copy' && copyBusy
              }"
              :style="emptyDockActionStyle(index)"
              @click="handleEmptyDockAction(action.key)"
            >
              <text class="cookfont manage-dock__action-icon" :class="action.iconClass" />
              <text class="manage-dock__action-label">{{ action.key === "copy" && copyBusy ? "复制中..." : action.label }}</text>
            </view>
          </view>
          <view class="manage-dock__button" hover-class="manage-dock__button--hover" hover-stay-time="100" @click="toggleEmptyDock">
            <text class="cookfont icon-manage manage-dock__icon" :class="{ 'manage-dock__icon--open': emptyDockOpen }" />
          </view>
        </view>
      </view>

      <SheetShell
        :visible="createPlanSheetVisible"
        title="添加计划"
        :subtitle="`会加在${selectedDateTitle}，先选这一天的餐次。`"
        @close="closeCreatePlanSheet"
        @after-close="handleCreatePlanSheetAfterClose"
      >
        <view class="sheet-chip-grid plan-slot-chip-grid">
          <view
            v-for="item in MEAL_SLOT_OPTIONS"
            :key="item.value"
            class="sheet-chip"
            :class="{
              'sheet-chip--active': createPlanSlot === item.value,
              'sheet-chip--filled': Boolean(selectedDatePlanMap.get(item.value)),
              'sheet-chip--disabled': isCreatePlanSlotExpired(item.value)
            }"
            @click="selectCreatePlanSlot(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
        <text class="sheet-section__hint plan-slot-hint">已安排的餐次会直接打开详情，已经过时的餐次不会再开放添加。</text>

        <template #footer>
          <view class="sheet-actions">
            <button
              class="sheet-actions__button sheet-actions__button--cancel"
              :class="{ 'sheet-actions__button--disabled': creatingPlan }"
              @click="closeCreatePlanSheet"
            >
              取消
            </button>
            <button
              class="sheet-actions__button sheet-actions__button--confirm"
              :class="{ 'sheet-actions__button--disabled': creatingPlan || isCreatePlanSlotExpired(createPlanSlot) }"
              @click="confirmCreatePlan"
            >
              {{
                creatingPlan
                  ? "处理中..."
                  : selectedDatePlanMap.get(createPlanSlot)
                    ? "查看这顿"
                    : "确认添加"
              }}
            </button>
          </view>
        </template>
      </SheetShell>

      <ShoppingListPickerSheet
        :visible="shoppingSheetVisible"
        :loading="shoppingListLoading"
        :error-text="shoppingListError"
        :items="shoppingLists"
        :selected-id="selectedShoppingListId"
        :create-name="shoppingCreateName"
        :submitting="shoppingSubmitting"
        @close="closeShoppingSheet"
        @after-close="handleShoppingSheetAfterClose"
        @retry="loadShoppingLists(true)"
        @create="createShoppingList"
        @confirm="confirmAddToShoppingList"
        @update:selected-id="selectedShoppingListId = $event"
        @update:create-name="shoppingCreateName = $event"
      />

  </Layout>
</template>

<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, nextTick, ref, watch } from "vue";
import { type UUID } from "@/apis/http";
import emptyStateArt from "@/assets/empty.png";
import { shoppingListApi, type ShoppingListSummary } from "../apis/shopping-list";
import { recipeApi, type RecipeDuration } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import ShoppingListPickerSheet from "@/components/Shopping/ShoppingListPickerSheet.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import {
  buildDefaultShoppingListName,
  buildMealShoppingListName,
  buildShoppingListDetailPath,
  hasShoppingListLink
} from "../utils/shopping";
import {
  appendMealSlotToMark,
  buildMealSlotTitle,
  createEmptyMealCalendarMark,
  formatMealSlot,
  isMealSlotExpired,
  MEAL_SLOT_OPTIONS,
  mealSlotOrder,
  resolveMealSlotExpireMs,
  resolveMealSlotTone,
  type MealCalendarMark,
  type MealSlot
} from "@/utils/meal-slot";
import { listWeekPlans, mealApi, type MealPlanSummary } from "../apis/meal";
import {
  addDays,
  addMonths,
  buildMonthTransitionPanels,
  buildWeekRangeStart,
  formatDateOnly,
  parseDateOnly,
  startOfWeek,
  todayText
} from "../utils/date";
import { isUuid } from "../utils/id";

interface WeekPanelDay {
  date: string;
  label: string;
  dayNumber: string;
  isToday: boolean;
  isSelected: boolean;
  mark: MealCalendarMark;
}

interface WeekPanel {
  key: string;
  days: WeekPanelDay[];
}

type PlanDockActionKey = "copy" | "add" | "recipe" | "shopping";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const loginModalStore = useLoginModalStore();
const sessionStore = useSessionStore();

const today = todayText();
const WEEK_PANEL_COUNT = 5;
const WEEK_PANEL_MID = Math.floor(WEEK_PANEL_COUNT / 2);
const WEEK_PANEL_EDGE_BUFFER = 1;
const WEEK_SWIPER_DURATION_MS = 280;
const PLAN_LOADING_TIPS = ["刷新这一周安排", "把最近的做饭计划拉下来", "看看这周有没有新安排"];
const plans = ref<MealPlanSummary[]>([]);
const loading = ref(false);
const copyBusy = ref(false);
const errorText = ref("");
const selectedDate = ref(today);
const weekSwiperCurrent = ref(WEEK_PANEL_MID);
const weekSwiperDuration = ref(WEEK_SWIPER_DURATION_MS);
const previewDate = ref("");
const loadedOnce = ref(false);
const planLoadSeq = ref(0);
const weekRangeStart = ref(buildWeekRangeStart(startOfWeek(parseDateOnly(today)), WEEK_PANEL_MID));
const weekPanelOverride = ref<Date[] | null>(null);
const weekSilentReset = ref(false);
const monthTransition = ref<{
  targetDate: string;
  targetIndex: number;
  targetWeekStart: string;
} | null>(null);
const shoppingSheetVisible = ref(false);
const shoppingListLoading = ref(false);
const shoppingListError = ref("");
const shoppingLists = ref<ShoppingListSummary[]>([]);
const selectedShoppingListId = ref<UUID | "">("");
const shoppingCreateName = ref("");
const shoppingSubmitting = ref(false);
const shoppingPlan = ref<MealPlanSummary | null>(null);
const emptyDockOpen = ref(false);
const createPlanSheetVisible = ref(false);
const creatingPlan = ref(false);
const createPlanSlot = ref<MealSlot>("DINNER");
const nowMs = ref(Date.now());
let planNowTimer: ReturnType<typeof setInterval> | null = null;
const {
  threshold: refresherThreshold,
  pullDistance,
  refreshing,
  showSuccess,
  refresherText,
  refresherTriggered,
  onRefresherPulling,
  onRefresherRefresh,
  onRefreshComplete,
  onRefresherRestore
} = useCustomRefresher({
  text: {
    pulling: "下拉刷新这一周安排",
    canRelease: PLAN_LOADING_TIPS,
    success: "计划已刷新"
  }
});

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const selectedWeekStart = computed(() => startOfWeek(parseDateOnly(selectedDate.value)));
const selectedWeekKey = computed(() => formatDateOnly(selectedWeekStart.value));
const activeWeekDate = computed(() => previewDate.value || selectedDate.value);
const weekPanelStarts = computed<Date[]>(() => {
  if (weekPanelOverride.value) {
    return weekPanelOverride.value;
  }
  return Array.from({ length: WEEK_PANEL_COUNT }, (_, index) => addDays(weekRangeStart.value, index * 7));
});
const monthTitle = computed(() => {
  const date = parseDateOnly(activeWeekDate.value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
});
const selectedDateTitle = computed(() => {
  const date = parseDateOnly(selectedDate.value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAY_LABELS[date.getDay()]}`;
});

const planMap = computed(() => {
  const dateMap = new Map<string, Map<MealSlot, MealPlanSummary>>();
  for (const item of plans.value) {
    const slotMap = dateMap.get(item.planDate) ?? new Map<MealSlot, MealPlanSummary>();
    slotMap.set(item.mealSlot, item);
    dateMap.set(item.planDate, slotMap);
  }
  return dateMap;
});

const selectedDatePlanMap = computed(() => planMap.value.get(selectedDate.value) ?? new Map<MealSlot, MealPlanSummary>());
const selectedPlans = computed(() => sortPlans(Array.from(selectedDatePlanMap.value.values())));
const selectedPlanCount = computed(() => selectedPlans.value.length);
const hasPlans = computed(() => selectedPlanCount.value > 0);
const selectedDateHint = computed(() => {
  return "先把这天想吃的安排上，买菜和约饭都会顺手很多。";
});
const canShowPlanDock = computed(() => !loading.value && !errorText.value);
const planDockActions = computed(() => {
  if (hasPlans.value) {
    return [
      { key: "add" as const, label: "添加计划", iconClass: "icon-add" },
      { key: "recipe" as const, label: "去菜谱", iconClass: "icon-go-recipe" },
      { key: "shopping" as const, label: "去清单", iconClass: "icon-shopping" }
    ];
  }
  return [
    { key: "copy" as const, label: "复制上周", iconClass: "icon-add-owner" },
    { key: "add" as const, label: "添加计划", iconClass: "icon-add" },
    { key: "recipe" as const, label: "去菜谱", iconClass: "icon-go-recipe" },
    { key: "shopping" as const, label: "去清单", iconClass: "icon-shopping" }
  ];
});
const hasContentCards = computed(() => Boolean(selectedPlanCount.value || loading.value));
const inlineLoading = computed(() => loading.value && hasContentCards.value && !refreshing.value);
const inlineLoadingText = computed(() => PLAN_LOADING_TIPS);
const weekPanels = computed<WeekPanel[]>(() => weekPanelStarts.value.map(weekStart => buildWeekPanel(weekStart)));
onLoad(query => {
  const nextDate = Array.isArray(query?.date) ? query.date[0] : query?.date;
  if (typeof nextDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(decodeURIComponent(nextDate))) {
    selectedDate.value = decodeURIComponent(nextDate);
    weekRangeStart.value = buildWeekRangeStart(startOfWeek(parseDateOnly(selectedDate.value)), WEEK_PANEL_MID);
  }
});

onShow(() => {
  startPlanNowTimer();
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
});

onHide(() => {
  stopPlanNowTimer();
});

onUnload(() => {
  stopPlanNowTimer();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
      return;
    }
    void loadPage();
  }
);

watch(
  () => selectedWeekKey.value,
  (nextKey, previousKey) => {
    if (!loadedOnce.value || nextKey === previousKey || !sessionStore.isLoggedIn) return;
    void loadWeekPlans();
  }
);

async function loadPage() {
  await loadWeekPlans();
  loadedOnce.value = true;
}

async function loadWeekPlans() {
  if (!sessionStore.isLoggedIn) return;
  const seq = ++planLoadSeq.value;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await listWeekPlans(selectedWeekStart.value);
    if (seq !== planLoadSeq.value) return;
    plans.value = result.items;
  } catch (error) {
    if (seq !== planLoadSeq.value) return;
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "本周计划加载失败", icon: "none" });
  } finally {
    if (seq === planLoadSeq.value) {
      loading.value = false;
    }
  }
}

async function handleRefresherRefresh() {
  if (!onRefresherRefresh()) return;
  try {
    await loadWeekPlans();
  } finally {
    await onRefreshComplete();
  }
}

function buildWeekPanel(weekStart: Date): WeekPanel {
  return {
    key: formatDateOnly(weekStart),
    days: Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dateText = formatDateOnly(date);
      const slotMap = planMap.value.get(dateText);
      const mark = createEmptyMealCalendarMark();
      if (slotMap) {
        slotMap.forEach((_, slot) => {
          appendMealSlotToMark(mark, slot);
        });
      }
      return {
        date: dateText,
        label: WEEKDAY_LABELS[index],
        dayNumber: `${date.getDate()}`,
        isToday: dateText === today,
        isSelected: dateText === activeWeekDate.value,
        mark
      };
    })
  };
}

function selectDate(date: string) {
  selectedDate.value = date;
}

function handleWeekSwiperChange(event: { detail?: { current?: number } }) {
  const current = event.detail?.current ?? weekSwiperCurrent.value;
  if (weekSilentReset.value) return;
  const targetWeekStart = weekPanelStarts.value[current];
  if (!targetWeekStart) return;
  if (monthTransition.value) {
    if (current !== monthTransition.value.targetIndex) return;
    const nextWeekStart = parseDateOnly(monthTransition.value.targetWeekStart);
    selectedDate.value = monthTransition.value.targetDate;
    previewDate.value = "";
    monthTransition.value = null;
    recenterWeekRange(nextWeekStart);
    return;
  }
  if (current === weekSwiperCurrent.value) return;
  const weekday = parseDateOnly(selectedDate.value).getDay();
  selectedDate.value = formatDateOnly(addDays(targetWeekStart, weekday));
  weekSwiperCurrent.value = current;
  maybeRecenterWeekRange(targetWeekStart);
}

function goMonth(offset: -1 | 1) {
  if (monthTransition.value || weekSilentReset.value) return;
  const nextDate = formatDateOnly(addMonths(parseDateOnly(selectedDate.value), offset));
  const targetWeekStart = startOfWeek(parseDateOnly(nextDate));
  const currentWeekStart = selectedWeekStart.value;
  if (formatDateOnly(targetWeekStart) === formatDateOnly(currentWeekStart)) {
    selectedDate.value = nextDate;
    return;
  }
  previewDate.value = nextDate;
  weekPanelOverride.value = buildMonthTransitionPanels(currentWeekStart, targetWeekStart, offset);
  monthTransition.value = {
    targetDate: nextDate,
    targetIndex: offset < 0 ? WEEK_PANEL_MID - 1 : WEEK_PANEL_MID + 1,
    targetWeekStart: formatDateOnly(targetWeekStart)
  };
  weekSwiperCurrent.value = WEEK_PANEL_MID;
  nextTick(() => {
    if (!monthTransition.value) return;
    weekSwiperCurrent.value = monthTransition.value.targetIndex;
  });
}

async function copyPreviousWeek() {
  if (copyBusy.value) return;
  closeEmptyDock();
  const previousDate = formatDateOnly(addDays(parseDateOnly(selectedDate.value), -7));

  copyBusy.value = true;
  try {
    const result = await mealApi.listPlans({
      from: previousDate,
      to: previousDate,
      page: 1,
      pageSize: 10
    });
    const previousPlans = sortPlans(result.items);
    if (!previousPlans.length) {
      await uniPlatform.feedback.toast({ title: "上周当天没有计划", icon: "none" });
      return;
    }

    const copyCandidates = previousPlans.filter(item => item.menuItems.every(menuItem => isUuid(menuItem.recipeId)));
    const skippedInvalid = previousPlans.length - copyCandidates.length;
    if (!copyCandidates.length) {
      await uniPlatform.feedback.toast({ title: "上周这一天的计划暂时复制不了", icon: "none" });
      return;
    }

    const confirmed = await uniPlatform.feedback.confirm({
      title: "复制上周",
      content: buildCopyConfirm(copyCandidates.length, skippedInvalid)
    });
    if (!confirmed) return;

    const recipeMap = new Map<UUID, { id: UUID; contentVersionId: UUID }>();
    const recipeIds = Array.from(new Set(copyCandidates.flatMap(item => item.menuItems.map(menuItem => menuItem.recipeId).filter(isUuid))));
    const recipes = await Promise.all(recipeIds.map(recipeId => recipeApi.getMyRecipe(recipeId)));
    recipes.forEach(recipe => recipeMap.set(recipe.id, recipe));
    for (const item of copyCandidates) {
      const menuItems = item.menuItems.map((menuItem, index) => {
        const recipe = menuItem.recipeId ? recipeMap.get(menuItem.recipeId) : null;
        if (!recipe) return null;
        return {
          slotType: menuItem.slotType,
          sortOrder: index,
          recipeId: recipe.id,
          recipeVersionId: recipe.contentVersionId,
          purchaseState: menuItem.purchaseState
        };
      });
      if (menuItems.some(menuItem => menuItem === null)) continue;
      const resolvedMenuItems = menuItems.filter((menuItem): menuItem is NonNullable<typeof menuItem> => Boolean(menuItem));
      await mealApi.createPlan({
        operationId: createOperationId(),
        planDate: selectedDate.value,
        mealSlot: item.mealSlot,
        expectedVersion: null,
        menuItems: resolvedMenuItems
      });
    }

    await loadWeekPlans();
    await uniPlatform.feedback.toast({ title: buildCopySummary(copyCandidates.length, skippedInvalid), icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "复制失败", icon: "none" });
  } finally {
    copyBusy.value = false;
  }
}

function openPlanDetail(plan: MealPlanSummary) {
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(plan.id))}&planDate=${encodeURIComponent(plan.planDate)}`
  );
}

function reloadWeek() {
  void loadWeekPlans();
}

function openRecipe() {
  closeEmptyDock();
  void uniPlatform.navigation.switchTab("/pages/recipe/index");
}

function resolveCreatePlanSlot() {
  return (
    MEAL_SLOT_OPTIONS.find(item => !isCreatePlanSlotExpired(item.value) && !selectedDatePlanMap.value.get(item.value))?.value ??
    MEAL_SLOT_OPTIONS.find(item => !isCreatePlanSlotExpired(item.value))?.value ??
    "DINNER"
  );
}

function isCreatePlanSlotExpired(slot: MealSlot) {
  return isMealSlotExpired(selectedDate.value, slot, new Date(nowMs.value));
}

function selectCreatePlanSlot(slot: MealSlot) {
  if (isCreatePlanSlotExpired(slot)) return;
  createPlanSlot.value = slot;
}

function openCreatePlanSheet() {
  closeEmptyDock();
  createPlanSlot.value = resolveCreatePlanSlot();
  createPlanSheetVisible.value = true;
}

function closeCreatePlanSheet() {
  if (creatingPlan.value) return;
  createPlanSheetVisible.value = false;
}

function finishCreatePlanSheet() {
  createPlanSheetVisible.value = false;
}

function handleCreatePlanSheetAfterClose() {
  createPlanSlot.value = "DINNER";
}

function openShoppingListPage() {
  closeEmptyDock();
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function toggleEmptyDock() {
  if (!canShowPlanDock.value) return;
  if (!sessionStore.isLoggedIn) {
    loginModalStore.open();
    return;
  }
  emptyDockOpen.value = !emptyDockOpen.value;
}

function closeEmptyDock() {
  emptyDockOpen.value = false;
}

function emptyDockActionStyle(index: number) {
  const total = planDockActions.value.length;
  return {
    transitionDelay: emptyDockOpen.value ? `${index * 44}ms` : `${(total - index - 1) * 28}ms`
  };
}

function handleEmptyDockAction(action: PlanDockActionKey) {
  if (action === "copy") {
    void copyPreviousWeek();
    return;
  }
  if (action === "add") {
    openCreatePlanSheet();
    return;
  }
  if (action === "shopping") {
    openShoppingListPage();
    return;
  }
  openRecipe();
}

async function confirmCreatePlan() {
  if (creatingPlan.value) return;
  if (isCreatePlanSlotExpired(createPlanSlot.value)) {
    await uniPlatform.feedback.toast({ title: "当前时间已经不能新建这餐了", icon: "none" });
    createPlanSlot.value = resolveCreatePlanSlot();
    return;
  }
  const existingPlan = selectedDatePlanMap.value.get(createPlanSlot.value);
  if (existingPlan) {
    closeCreatePlanSheet();
    openPlanDetail(existingPlan);
    return;
  }

  creatingPlan.value = true;
  try {
    const plan = await mealApi.createPlan({
      operationId: createOperationId(),
      planDate: selectedDate.value,
      mealSlot: createPlanSlot.value,
      expectedVersion: null,
      menuItems: []
    });
    finishCreatePlanSheet();
    openPlanDetail(plan);
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "添加计划失败", icon: "none" });
  } finally {
    creatingPlan.value = false;
  }
}

async function addPlanToShoppingList(plan: MealPlanSummary) {
  if (shoppingSubmitting.value) return;
  if (isPlanExpired(plan, nowMs.value) || plan.status === "COMPLETED") {
    await uniPlatform.feedback.toast({ title: "这条计划已经结束，不能再加入采购清单", icon: "none" });
    return;
  }
  if (!hasPlanShoppingRecipes(plan)) {
    await uniPlatform.feedback.toast({ title: "当前餐次没有可加入采购清单的菜谱", icon: "none" });
    return;
  }
  shoppingPlan.value = plan;
  try {
    await openShoppingSheet();
  } catch (error) {
    shoppingPlan.value = null;
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "清单加载失败", icon: "none" });
  }
}

function planShoppingActionText(plan: MealPlanSummary) {
  if (hasShoppingListLink(plan)) return "查看采购清单";
  return shoppingSubmitting.value && shoppingPlan.value?.id === plan.id ? "加入中..." : "加入采购清单";
}

function openLinkedShoppingList(plan: MealPlanSummary) {
  if (!plan.shoppingListId) return;
  void uniPlatform.navigation.navigateTo(buildShoppingListDetailPath(plan.shoppingListId));
}

function handlePlanShoppingAction(plan: MealPlanSummary) {
  if (hasShoppingListLink(plan)) {
    openLinkedShoppingList(plan);
    return;
  }
  void addPlanToShoppingList(plan);
}

function visibleMenuItems(plan: MealPlanSummary) {
  return plan.menuItems.slice(0, 5);
}

function hasMoreMenuItems(plan: MealPlanSummary) {
  return plan.menuItems.length > 5;
}

function planDishCountText(plan: MealPlanSummary) {
  return `${plan.menuItems.length}道菜`;
}

function planCardTitle(plan: MealPlanSummary) {
  return plan.title?.trim() || slotPlanTitle(plan.mealSlot);
}

function planCardStateText(plan: MealPlanSummary) {
  if (plan.status === "COMPLETED") return "已完成";
  if (isPlanExpired(plan, nowMs.value)) return "已结束";
  return "";
}

function recipeDurationMinutes(value: RecipeDuration | null) {
  if (value === "WITHIN_15") return 15;
  if (value === "BETWEEN_15_30") return 30;
  if (value === "BETWEEN_30_60") return 50;
  if (value === "OVER_60") return 75;
  return null;
}

function formatPlanDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) return "";
  if (minutes < 60) return `预计${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `预计${hours}小时${remaining}分钟` : `预计${hours}小时`;
}

function planDurationMinutes(plan: MealPlanSummary) {
  if (!plan.menuItems.length) return null;

  let total = 0;
  let hasDuration = false;
  for (const item of plan.menuItems) {
    const minutes = recipeDurationMinutes(item.duration);
    if (minutes != null) {
      total += minutes;
      hasDuration = true;
    }
  }
  return hasDuration ? total : null;
}

function planDurationText(plan: MealPlanSummary) {
  return formatPlanDuration(planDurationMinutes(plan));
}

function planDiningText(plan: MealPlanSummary) {
  return "约了饭";
}

function slotLabel(slot: MealSlot) {
  return formatMealSlot(slot);
}

function slotPlanTitle(slot: MealSlot) {
  return buildMealSlotTitle(slot);
}

function slotTone(slot: MealSlot) {
  return resolveMealSlotTone(slot);
}

function slotOrder(slot: MealSlot) {
  return mealSlotOrder(slot);
}

function buildCopyConfirm(copiedCount: number, skippedInvalid: number) {
  const parts = [`会把上周同一天的 ${copiedCount} 条安排复制到${selectedDateTitle.value}。`];
  parts.push("复制后可以去详情页手动删除不想保留的餐次。");
  if (skippedInvalid) {
    parts.push(`有 ${skippedInvalid} 条旧安排因为缺少有效菜谱引用会跳过。`);
  }
  return parts.join("");
}

function buildCopySummary(copiedCount: number, skippedInvalid: number) {
  const parts = [`已复制 ${copiedCount} 餐`];
  if (skippedInvalid) {
    parts.push(`跳过旧数据 ${skippedInvalid} 餐`);
  }
  return parts.join("，");
}

function hasPlanShoppingRecipes(plan: MealPlanSummary) {
  return plan.menuItems.some(item => isUuid(item.recipeId) && isUuid(item.recipeVersionId));
}

function canShowShoppingAction(plan: MealPlanSummary) {
  return !isPlanExpired(plan, nowMs.value) && plan.status !== "COMPLETED";
}

function resolvePlanDeadlineMs(plan: Pick<MealPlanSummary, "planDate" | "mealSlot">) {
  return resolveMealSlotExpireMs(plan.planDate, plan.mealSlot);
}

function isPlanExpired(plan: Pick<MealPlanSummary, "planDate" | "mealSlot">, currentMs = Date.now()) {
  const deadlineMs = resolvePlanDeadlineMs(plan);
  return deadlineMs > 0 && deadlineMs <= currentMs;
}

function closeShoppingSheet() {
  shoppingSheetVisible.value = false;
}

function handleShoppingSheetAfterClose() {
  shoppingListError.value = "";
  shoppingCreateName.value = "";
  shoppingPlan.value = null;
}

async function loadShoppingLists(force = false) {
  if (shoppingListLoading.value && !force) return;
  shoppingListLoading.value = true;
  shoppingListError.value = "";
  try {
    shoppingLists.value = await shoppingListApi.listActive();
    if (selectedShoppingListId.value && !shoppingLists.value.some(item => item.id === selectedShoppingListId.value)) {
      selectedShoppingListId.value = "";
    }
    if (!selectedShoppingListId.value) {
      selectedShoppingListId.value = shoppingLists.value[0]?.id || "";
    }
  } catch (error) {
    shoppingListError.value = error instanceof Error ? error.message : "清单加载失败";
  } finally {
    shoppingListLoading.value = false;
  }
}

async function openShoppingSheet() {
  await loadShoppingLists(true);
  if (!shoppingCreateName.value.trim()) {
    shoppingCreateName.value = buildShoppingDraftName(shoppingPlan.value);
  }
  shoppingSheetVisible.value = true;
}

async function createShoppingList() {
  if (shoppingSubmitting.value) return;
  shoppingSubmitting.value = true;
  try {
    const created = await shoppingListApi.createList({
      operationId: createOperationId(),
      name: shoppingCreateName.value.trim() || buildShoppingDraftName(shoppingPlan.value)
    });
    await loadShoppingLists(true);
    selectedShoppingListId.value = created.id;
    shoppingCreateName.value = buildShoppingDraftName(shoppingPlan.value);
    await uniPlatform.feedback.toast({ title: "清单已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

async function confirmAddToShoppingList() {
  if (!shoppingPlan.value || !selectedShoppingListId.value || shoppingSubmitting.value) return;
  if (isPlanExpired(shoppingPlan.value, nowMs.value) || shoppingPlan.value.status === "COMPLETED") {
    closeShoppingSheet();
    await uniPlatform.feedback.toast({ title: "这条计划已经结束，不能再加入采购清单", icon: "none" });
    return;
  }
  shoppingSubmitting.value = true;
  try {
    const listId = selectedShoppingListId.value;
    await shoppingListApi.addPlanToList(listId, {
      operationId: createOperationId(),
      planItemId: shoppingPlan.value.id
    });
    await loadWeekPlans();
    closeShoppingSheet();
    await uniPlatform.feedback.toast({ title: "已加入采购清单", icon: "success" });
    void uniPlatform.navigation.navigateTo(buildShoppingListDetailPath(listId));
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入采购清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

function sortPlans(items: MealPlanSummary[]) {
  return [...items].sort((left, right) => slotOrder(left.mealSlot) - slotOrder(right.mealSlot));
}

function buildShoppingDraftName(plan?: Pick<MealPlanSummary, "planDate" | "mealSlot"> | null) {
  if (!plan) {
    return buildDefaultShoppingListName();
  }
  return buildMealShoppingListName(formatMealSlot(plan.mealSlot), new Date(`${plan.planDate}T00:00:00`));
}

function startPlanNowTimer() {
  if (planNowTimer) return;
  nowMs.value = Date.now();
  planNowTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
}

function stopPlanNowTimer() {
  if (!planNowTimer) return;
  clearInterval(planNowTimer);
  planNowTimer = null;
}

function maybeRecenterWeekRange(targetWeekStart: Date) {
  if (
    weekSwiperCurrent.value >= WEEK_PANEL_EDGE_BUFFER &&
    weekSwiperCurrent.value < WEEK_PANEL_COUNT - WEEK_PANEL_EDGE_BUFFER
  ) {
    return;
  }
  recenterWeekRange(targetWeekStart);
}

function recenterWeekRange(targetWeekStart: Date) {
  weekSilentReset.value = true;
  weekSwiperDuration.value = 0;
  weekRangeStart.value = buildWeekRangeStart(targetWeekStart, WEEK_PANEL_MID);
  weekPanelOverride.value = null;
  weekSwiperCurrent.value = WEEK_PANEL_MID;
  nextTick(() => {
    weekSwiperDuration.value = WEEK_SWIPER_DURATION_MS;
    setTimeout(() => {
      weekSilentReset.value = false;
    }, 0);
  });
}

function clearPageState() {
  plans.value = [];
  loading.value = false;
  copyBusy.value = false;
  errorText.value = "";
  selectedDate.value = today;
  loadedOnce.value = false;
  previewDate.value = "";
  weekRangeStart.value = buildWeekRangeStart(startOfWeek(parseDateOnly(today)), WEEK_PANEL_MID);
  weekPanelOverride.value = null;
  weekSilentReset.value = false;
  monthTransition.value = null;
  weekSwiperCurrent.value = WEEK_PANEL_MID;
  weekSwiperDuration.value = WEEK_SWIPER_DURATION_MS;
  shoppingSheetVisible.value = false;
  shoppingListLoading.value = false;
  shoppingListError.value = "";
  shoppingLists.value = [];
  selectedShoppingListId.value = "";
  shoppingCreateName.value = "";
  shoppingSubmitting.value = false;
  shoppingPlan.value = null;
  emptyDockOpen.value = false;
  createPlanSheetVisible.value = false;
  creatingPlan.value = false;
  createPlanSlot.value = "DINNER";
}

function automatorReadGuestState() {
  return {
    loggedIn: sessionStore.isLoggedIn,
    showPlanDock: canShowPlanDock.value,
    dockOpen: emptyDockOpen.value,
    loginModalVisible: loginModalStore.visible
  };
}

async function automatorClearSession() {
  await sessionStore.clearSession();
  loginModalStore.close();
}

async function automatorTapGuestDock() {
  toggleEmptyDock();
  return automatorReadGuestState();
}

defineExpose({
  automatorClearSession,
  automatorReadGuestState,
  automatorTapGuestDock
});

</script>

<style scoped lang="scss">
.plan-scroll {
  height: 100%;
}

.plan-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.plan-fixed-head {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  padding: 0 var(--space-page);
  box-sizing: border-box;
  background: inherit;
  border-bottom: 1rpx solid var(--color-divider);
}

.plan-scroll-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.plan-scroll-area {
  position: relative;
  flex: 1;
  min-height: 0;
}

.plan-scroll__body {
  min-height: 100%;
  padding: 8rpx var(--space-page) 48rpx;
  box-sizing: border-box;
}

.month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28rpx;
  margin-bottom: 20rpx;
}

.month-bar__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
}

.month-bar__arrow--hover {
  transform: scale(0.98);
}

.month-bar__arrow-icon {
  color: var(--color-text);
  font-size: 26rpx;
}

.month-bar__arrow-icon--right {
  transform: rotate(180deg);
}

.month-bar__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
}

.week-swiper {
  height: 130rpx;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-page);
}

.week-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.week-day--hover {
  transform: translateY(-2rpx);
}

.week-day__label {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.week-day__number-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  margin-top: 12rpx;
  border-radius: var(--radius-xs);
}

.week-day__number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.week-day__dots {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42rpx;
  gap: 2rpx;
  min-height: 24rpx;
}

.week-day__dot {
  width: 10rpx;
  height: 10rpx;
  flex-shrink: 0;
  border-radius: 999rpx;
}

.week-day__dot--breakfast {
  background: var(--meal-slot-breakfast);
}

.week-day__dot--lunch {
  background: var(--meal-slot-lunch);
}

.week-day__dot--afternoon-tea {
  background: var(--meal-slot-afternoon-tea);
}

.week-day__dot--dinner {
  background: var(--meal-slot-dinner);
}

.week-day__dot--late-night {
  background: var(--meal-slot-late-night);
}

.week-day--selected .week-day__number-shell {
  background: var(--color-tag-primary-bg);
}

.week-day--selected .week-day__number {
  color: var(--color-tag-primary-text);
}

.week-day--selected .week-day__label {
  color: var(--color-tag-primary-text);
}

.week-day--today:not(.week-day--selected) .week-day__number-shell {
  background: var(--meal-slot-dinner-soft);
}

.day-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  flex: 0 0 auto;
  padding: 20rpx var(--space-page) 12rpx;
  background: inherit;
  box-sizing: border-box;
}

.day-head__title {
  display: block;
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
}

.day-head__subtitle {
  display: block;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notice,
.meal-card {
  border-radius: var(--radius-card);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice {
  margin-top: 24rpx;
  padding: 28rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.notice--sheet {
  margin-top: 18rpx;
}

.plan-scroll__body :deep(.empty-state--art) {
  margin-top: 0;
}

.meal-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
}

.meal-card {
  position: relative;
  display: block;
  overflow: hidden;
  min-height: 220rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
}

.meal-card::before {
  content: "";
  position: absolute;
  top: 16rpx;
  left: 18rpx;
  bottom: 0;
  width: 176rpx;
  border-radius: 32rpx 0 0 32rpx;
  box-shadow: inset 0 0 0 1rpx var(--color-border-light);
  transform: skewX(-12deg);
  transform-origin: left center;
}

.meal-card::after {
  content: "";
  position: absolute;
  top: 18rpx;
  left: 20rpx;
  bottom: 18rpx;
  width: 184rpx;
  border-radius: 34rpx 0 0 34rpx;
  background: var(--plan-slot-band-pattern);
  opacity: 0.92;
  transform: skewX(-12deg);
  transform-origin: left center;
}

.meal-card--hover {
  transform: translateY(-2rpx);
}

.meal-card--breakfast {
  background: linear-gradient(135deg, var(--meal-slot-breakfast-soft) 0%, var(--color-surface) 100%);
}

.meal-card--breakfast::before {
  background: linear-gradient(160deg, var(--color-surface) 0%, var(--meal-slot-breakfast-soft) 100%);
}

.meal-card--breakfast::after {
  background:
    radial-gradient(circle at 28% 28%, var(--meal-slot-breakfast-soft) 0 18%, transparent 19%),
    radial-gradient(circle at 46% 18%, var(--meal-slot-breakfast-soft) 0 14%, transparent 15%),
    radial-gradient(circle at 62% 38%, var(--meal-slot-breakfast-soft) 0 13%, transparent 14%),
    radial-gradient(circle at 54% 70%, var(--meal-slot-breakfast-soft) 0 16%, transparent 17%);
}

.meal-card--breakfast .meal-card__slot {
  background: var(--meal-slot-breakfast-soft);
  color: var(--meal-slot-breakfast);
}

.meal-card--lunch {
  background: linear-gradient(135deg, var(--meal-slot-lunch-soft) 0%, var(--color-surface) 100%);
}

.meal-card--lunch::before {
  background: linear-gradient(160deg, var(--color-surface) 0%, var(--meal-slot-lunch-soft) 100%);
}

.meal-card--lunch::after {
  background:
    radial-gradient(circle at 32% 72%, var(--meal-slot-lunch-soft) 0 18%, transparent 19%),
    radial-gradient(circle at 68% 58%, var(--meal-slot-lunch-soft) 0 14%, transparent 15%),
    radial-gradient(circle at 70% 20%, var(--meal-slot-lunch-soft) 0 12%, transparent 13%),
    radial-gradient(circle at 20% 38%, var(--meal-slot-lunch-soft) 0 12%, transparent 13%);
}

.meal-card--lunch .meal-card__slot {
  background: var(--meal-slot-lunch-soft);
  color: var(--meal-slot-lunch);
}

.meal-card--dinner {
  background: linear-gradient(135deg, var(--meal-slot-dinner-soft) 0%, var(--color-surface) 100%);
}

.meal-card--dinner::before {
  background: linear-gradient(160deg, var(--color-surface) 0%, var(--meal-slot-dinner-soft) 100%);
}

.meal-card--dinner::after {
  background:
    radial-gradient(circle at 72% 24%, var(--meal-slot-dinner-soft) 0 18%, transparent 19%),
    radial-gradient(circle at 46% 48%, var(--meal-slot-dinner-soft) 0 14%, transparent 15%),
    radial-gradient(circle at 24% 72%, var(--meal-slot-dinner-soft) 0 13%, transparent 14%),
    radial-gradient(circle at 62% 78%, var(--meal-slot-dinner-soft) 0 12%, transparent 13%);
}

.meal-card--dinner .meal-card__slot {
  background: var(--meal-slot-dinner-soft);
  color: var(--meal-slot-dinner);
}

.meal-card--afternoon-tea {
  background: linear-gradient(135deg, var(--meal-slot-afternoon-tea-soft) 0%, var(--color-surface) 100%);
}

.meal-card--afternoon-tea::before {
  background: linear-gradient(160deg, var(--color-surface) 0%, var(--meal-slot-afternoon-tea-soft) 100%);
}

.meal-card--afternoon-tea::after {
  background:
    radial-gradient(circle at 24% 26%, var(--meal-slot-afternoon-tea-soft) 0 16%, transparent 17%),
    radial-gradient(circle at 50% 18%, var(--meal-slot-afternoon-tea-soft) 0 12%, transparent 13%),
    radial-gradient(circle at 74% 70%, var(--meal-slot-afternoon-tea-soft) 0 15%, transparent 16%),
    radial-gradient(circle at 38% 74%, var(--meal-slot-afternoon-tea-soft) 0 12%, transparent 13%);
}

.meal-card--afternoon-tea .meal-card__slot {
  background: var(--meal-slot-afternoon-tea-soft);
  color: var(--meal-slot-afternoon-tea);
}

.meal-card--late-night {
  background: linear-gradient(135deg, var(--meal-slot-late-night-soft) 0%, var(--color-surface) 100%);
}

.meal-card--late-night::before {
  background: linear-gradient(160deg, var(--color-surface) 0%, var(--meal-slot-late-night-soft) 100%);
}

.meal-card--late-night::after {
  background:
    radial-gradient(circle at 24% 26%, var(--meal-slot-late-night-soft) 0 16%, transparent 17%),
    radial-gradient(circle at 50% 18%, var(--meal-slot-late-night-soft) 0 12%, transparent 13%),
    radial-gradient(circle at 74% 70%, var(--meal-slot-late-night-soft) 0 15%, transparent 16%),
    radial-gradient(circle at 38% 74%, var(--meal-slot-late-night-soft) 0 12%, transparent 13%);
}

.meal-card--late-night .meal-card__slot {
  background: var(--meal-slot-late-night-soft);
  color: var(--meal-slot-late-night);
}

.meal-card__event-badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  max-width: 220rpx;
  padding: 10rpx 18rpx;
  border-radius: 0 0 0 var(--radius-xs);
  color: var(--meal-slot-dinner);
  font-size: 20rpx;
  line-height: 1;
  background: var(--meal-slot-dinner-soft);
  box-shadow: var(--shadow-card);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.meal-card--breakfast .meal-card__event-badge {
  background: var(--meal-slot-breakfast-soft);
  color: var(--meal-slot-breakfast);
}

.meal-card--lunch .meal-card__event-badge {
  background: var(--meal-slot-lunch-soft);
  color: var(--meal-slot-lunch);
}

.meal-card--dinner .meal-card__event-badge {
  background: var(--meal-slot-dinner-soft);
  color: var(--meal-slot-dinner);
}

.meal-card--afternoon-tea .meal-card__event-badge {
  background: var(--meal-slot-afternoon-tea-soft);
  color: var(--meal-slot-afternoon-tea);
}

.meal-card--late-night .meal-card__event-badge {
  background: var(--meal-slot-late-night-soft);
  color: var(--meal-slot-late-night);
}

.meal-card__panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
}

.meal-card__title-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.meal-card__head-main {
  flex: 1;
  min-width: 0;
}

.meal-card__title-main {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.meal-card__title {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
  word-break: break-word;
}

.meal-card__state {
  flex: 0 0 auto;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-state-success-soft);
  color: var(--color-state-success-text);
  font-size: 20rpx;
}

.meal-card__slot {
  flex: 0 0 auto;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  font-size: 20rpx;
  font-weight: var(--font-weight-semibold);
}

.meal-card__menu-list {
  position: relative;
  z-index: 1;
  margin-top: 18rpx;
}

.meal-card__menu-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.meal-card__menu-row + .meal-card__menu-row {
  margin-top: 12rpx;
}

.meal-card__menu-row--more {
  margin-top: 8rpx;
}

.meal-card__menu-name {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meal-card__menu-dash {
  flex: 1;
  min-width: 32rpx;
  height: 0;
  border-bottom: 2rpx dashed var(--color-divider);
  transform: translateY(2rpx);
}

.meal-card__menu-servings {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.5;
}

.meal-card__menu-more {
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.4;
}

.meal-card__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  margin-top: 10rpx;
}

.meal-card__meta-text,
.meal-card__meta-divider {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.5;
  font-weight: var(--font-weight-medium);
}

.meal-card__meta-divider {
  flex: 0 0 auto;
}

.meal-card__footer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: auto;
  padding-top: 20rpx;
}

.meal-card__actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.meal-card__action-button {
  flex: 0 0 auto;
}

.meal-card__action-button--disabled {
  opacity: 0.54;
}

.sheet-section {
  margin-top: 28rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.sheet-section__hint {
  display: block;
  margin-top: 18rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  line-height: 1.6;
}

.sheet-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.plan-slot-chip-grid {
  margin-top: 4rpx;
}

.sheet-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.sheet-chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.sheet-chip--filled {
  border-style: dashed;
}

.sheet-chip--disabled {
  opacity: 0.38;
}

.plan-slot-hint {
  margin-top: 18rpx;
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
}

.sheet-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 90rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--confirm {
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.sheet-actions__button--cancel {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.sheet-actions__button--disabled {
  opacity: 0.46;
}

.floating-dock {
  position: fixed;
  right: 24rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 30;
}

.floating-dock__backdrop {
  position: fixed;
  inset: 0;
  background: transparent;
}

.manage-dock {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 92rpx;
  min-height: 92rpx;
  margin-left: auto;
  padding-bottom: 52rpx;
}

.manage-dock__actions {
  position: absolute;
  top: 0;
  right: calc(100% + 50rpx);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 50rpx;
  pointer-events: none;
}

.manage-dock__action {
  position: relative;
  display: inline-flex;
  flex: 0 0 92rpx;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  padding: 0;
  border-radius: 50%;
  background: var(--button-secondary-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--color-text);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(26rpx) scale(0.92);
  pointer-events: none;
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 180ms ease;
}

.manage-dock__action--open {
  opacity: 1;
  transform: translateX(0) scale(1);
  pointer-events: auto;
}

.manage-dock__action--disabled {
  opacity: 0.58;
}

.manage-dock__action-icon {
  color: var(--color-icon-active);
  font-size: 34rpx;
}

.manage-dock__action-label {
  position: absolute;
  top: calc(100% + 14rpx);
  left: 50%;
  transform: translateX(-50%);
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.3;
  font-weight: var(--font-weight-semibold);
  text-align: center;
  white-space: nowrap;
}

.manage-dock__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.manage-dock__button--hover {
  opacity: 0.94;
}

.manage-dock__icon {
  color: var(--button-primary-text);
  font-size: 34rpx;
  transition: transform 240ms ease;
}

.manage-dock__icon--open {
  transform: rotate(90deg);
}

.manage-dock__action::after {
  display: none;
}

</style>
