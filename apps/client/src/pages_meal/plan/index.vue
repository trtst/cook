<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="美食计划" full-screen>
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看美食计划"
      description="按天查看你的做饭安排，再决定这顿饭要不要继续发起饭局。"
    />

    <template v-else>
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
                    <view v-if="day.mark.dinner" class="week-day__dot week-day__dot--dinner" />
                    <text v-if="day.mark.hasExtra" class="week-day__extra">+</text>
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
                            :class="{ 'meal-card__action-button--disabled': shoppingSubmitting && shoppingPlan?.id === plan.id }"
                            :disabled="shoppingSubmitting && shoppingPlan?.id === plan.id"
                            @click.stop="addPlanToShoppingList(plan)"
                          >
                            {{ shoppingSubmitting && shoppingPlan?.id === plan.id ? "加入中..." : "加入采购清单" }}
                          </button>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>

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
        :visible="shoppingSheetVisible"
        title="加入采购清单"
        subtitle="先选一张采购中的清单，也可以现场新建空白清单。"
        @close="closeShoppingSheet"
        @after-close="handleShoppingSheetAfterClose"
      >
        <view class="sheet-section">
          <text class="sheet-section__title">采购中清单</text>
          <view v-if="shoppingListLoading" class="notice notice--sheet">加载中...</view>
          <view v-else-if="shoppingListError" class="notice notice--sheet" @click="loadShoppingLists(true)">{{ shoppingListError }}</view>
          <view v-else-if="shoppingLists.length" class="shopping-list-grid">
            <view
              v-for="item in shoppingLists"
              :key="item.id"
              class="shopping-list-option"
              :class="{ 'shopping-list-option--active': selectedShoppingListId === item.id }"
              @click="selectedShoppingListId = item.id"
            >
              <text class="shopping-list-option__title">{{ item.name }}</text>
              <text class="shopping-list-option__meta">{{ item.progressDoneCount }}/{{ item.progressTotalCount }} · {{ item.memberCount }} 人</text>
            </view>
          </view>
          <text v-else class="sheet-section__hint">还没有采购中的清单，先新建一张空白清单。</text>
        </view>

        <view class="sheet-section">
          <text class="sheet-section__title">新建空白清单</text>
          <view class="shopping-create">
            <input
              v-model="shoppingCreateName"
              class="shopping-create__input"
              maxlength="30"
              placeholder="清单名可不填，系统会自动生成"
            />
            <view class="shopping-create__button" @click="createShoppingList">新建</view>
          </view>
        </view>

        <template #footer>
          <view class="sheet-actions">
            <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="shoppingSubmitting" @click="closeShoppingSheet">
              取消
            </button>
            <button
              class="sheet-actions__button sheet-actions__button--confirm"
              :disabled="shoppingSubmitting || !selectedShoppingListId"
              @click="confirmAddToShoppingList"
            >
              {{ shoppingSubmitting ? "加入中..." : "确认加入" }}
            </button>
          </view>
        </template>
      </SheetShell>

      <SheetShell
        v-if="sortSheetMounted"
        :visible="sortSheetVisible"
        title="调整当天顺序"
        subtitle="长按卡片拖动，只调整计划页展示顺序。"
        @close="closeSortSheet"
        @after-close="handleSortSheetAfterClose"
      >
        <view
          class="plan-sort"
          @touchmove.stop="handlePlanSortTouchMove"
          @touchend.stop="finishPlanSortDrag"
          @touchcancel.stop="finishPlanSortDrag"
        >
          <view class="plan-sort__summary">
            <text class="plan-sort__summary-date">{{ selectedDateTitle }}</text>
            <text class="plan-sort__summary-count">{{ planSortRows.length }} 条安排</text>
          </view>

          <scroll-view
            id="plan-sort-scroll"
            class="plan-sort__scroll"
            :scroll-y="!planSortDragging"
            :show-scrollbar="false"
            @scroll="handlePlanSortScroll"
          >
            <view class="plan-sort__list">
              <view
                v-for="(plan, index) in planSortRows"
                :id="`plan-sort-card-${plan.id}`"
                :key="plan.id"
                class="plan-sort-card"
                :class="{ 'plan-sort-card--placeholder': planSortDraggingId === plan.id }"
                @touchstart.stop="handlePlanSortTouchStart(plan.id, $event)"
              >
                <view class="plan-sort-card__order">{{ String(index + 1).padStart(2, "0") }}</view>
                <view class="plan-sort-card__main">
                  <view class="plan-sort-card__title-row">
                    <text class="plan-sort-card__title">{{ plan.title }}</text>
                    <text class="plan-sort-card__slot">{{ slotLabel(plan.mealSlot) }}</text>
                  </view>
                  <text class="plan-sort-card__meta">{{ summarizeMenu(plan) }}</text>
                </view>
                <text class="cookfont icon-drag plan-sort-card__drag" />
              </view>
            </view>
          </scroll-view>
        </view>

        <template #footer>
          <view class="plan-sort__footer">
            <view class="plan-sort__button plan-sort__button--ghost" @click="closeSortSheet">先不改</view>
            <view class="plan-sort__button plan-sort__button--primary" @click="confirmSortSheet">保存顺序</view>
          </view>
        </template>
      </SheetShell>

      <view v-if="planSortGhostPlan" class="plan-sort__ghost" :style="planSortGhostStyle">
        <view class="plan-sort-card plan-sort-card--ghost">
          <view class="plan-sort-card__order">{{ String(planSortGhostIndex + 1).padStart(2, "0") }}</view>
          <view class="plan-sort-card__main">
            <view class="plan-sort-card__title-row">
              <text class="plan-sort-card__title">{{ planSortGhostPlan.title }}</text>
              <text class="plan-sort-card__slot">{{ slotLabel(planSortGhostPlan.mealSlot) }}</text>
            </view>
            <text class="plan-sort-card__meta">{{ summarizeMenu(planSortGhostPlan) }}</text>
          </view>
          <text class="cookfont icon-drag plan-sort-card__drag plan-sort-card__drag--ghost" />
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, nextTick, ref, watch } from "vue";
import { type UUID } from "@/apis/http";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import { shoppingListApi, type ShoppingListSummary } from "../apis/shopping-list";
import { recipeApi, type RecipeDuration } from "@/apis/recipe";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import {
  appendMealSlotToMark,
  buildMealSlotTitle,
  createEmptyMealCalendarMark,
  formatMealSlot,
  mealSlotDefaultTime,
  mealSlotOrder,
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
import { clampNumber, readTouchY } from "../utils/gesture";
import { dedupeIds, isUuid } from "../utils/id";
import { getPlanSortRowSpan as resolvePlanSortRowSpan, movePlanRow } from "../utils/plan";

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

type PlanOrderState = Record<string, UUID[]>;
type PlanDockActionKey = "copy" | "recipe" | "shopping";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();

const today = todayText();
const PLAN_ORDER_STORAGE_KEY = "meal-plan-order/v1";
const PLAN_SORT_PRESS_DELAY_MS = 260;
const PLAN_SORT_PRESS_MOVE_PX = 8;
const PLAN_SORT_GAP_RPX = 20;
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
const planOrderMap = ref<PlanOrderState>({});
const sortSheetMounted = ref(false);
const sortSheetVisible = ref(false);
const planSortRows = ref<MealPlanSummary[]>([]);
const planSortDraggingId = ref<UUID | "">("");
const planSortListTop = ref(0);
const planSortCardLeft = ref(0);
const planSortCardWidth = ref(0);
const planSortCardHeight = ref(0);
const planSortGhostTop = ref(0);
const planSortStartTouchY = ref(0);
const planSortStartCardTop = ref(0);
const planSortScrollTop = ref(0);
const shoppingSheetVisible = ref(false);
const shoppingListLoading = ref(false);
const shoppingListError = ref("");
const shoppingLists = ref<ShoppingListSummary[]>([]);
const selectedShoppingListId = ref<UUID | "">("");
const shoppingCreateName = ref("");
const shoppingSubmitting = ref(false);
const shoppingPlan = ref<MealPlanSummary | null>(null);
const emptyDockOpen = ref(false);
const nowMs = ref(Date.now());
let planSortPressTimer: ReturnType<typeof setTimeout> | null = null;
let planNowTimer: ReturnType<typeof setInterval> | null = null;
let planSortPressId: UUID | "" = "";
let planSortPressTouchY = 0;
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
const selectedPlans = computed(() => sortPlans(Array.from(selectedDatePlanMap.value.values()), selectedDate.value));
const selectedPlanCount = computed(() => selectedPlans.value.length);
const hasPlans = computed(() => selectedPlanCount.value > 0);
const selectedDateHint = computed(() => {
  return "先把这天想吃的安排上，买菜和约饭都会顺手很多。";
});
const canShowPlanDock = computed(() => !loading.value && !errorText.value);
const planDockActions = computed(() => {
  if (hasPlans.value) {
    return [
      { key: "recipe" as const, label: "去菜谱", iconClass: "icon-go-recipe" },
      { key: "shopping" as const, label: "去清单", iconClass: "icon-shopping" }
    ];
  }
  return [
    { key: "copy" as const, label: "复制上周", iconClass: "icon-add-owner" },
    { key: "recipe" as const, label: "去菜谱", iconClass: "icon-go-recipe" },
    { key: "shopping" as const, label: "去清单", iconClass: "icon-shopping" }
  ];
});
const canSortPlans = computed(() => selectedPlanCount.value > 1);
const hasContentCards = computed(() => Boolean(selectedPlanCount.value || loading.value));
const inlineLoading = computed(() => loading.value && hasContentCards.value && !refreshing.value);
const inlineLoadingText = computed(() => PLAN_LOADING_TIPS);
const weekPanels = computed<WeekPanel[]>(() => weekPanelStarts.value.map(weekStart => buildWeekPanel(weekStart)));
const planSortDragging = computed(() => Boolean(planSortDraggingId.value));
const planSortGhostPlan = computed(() => planSortRows.value.find(item => item.id === planSortDraggingId.value) ?? null);
const planSortGhostIndex = computed(() => {
  const index = planSortRows.value.findIndex(item => item.id === planSortDraggingId.value);
  return index >= 0 ? index : 0;
});
const planSortGhostStyle = computed(() => ({
  top: `${planSortGhostTop.value}px`,
  left: `${planSortCardLeft.value}px`,
  width: `${planSortCardWidth.value}px`
}));

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
  planOrderMap.value = readPlanOrderState();
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

async function openSortSheet() {
  if (selectedPlans.value.length <= 1) return;
  planSortRows.value = [...selectedPlans.value];
  planSortDraggingId.value = "";
  planSortScrollTop.value = 0;
  sortSheetMounted.value = true;
  await nextTick();
  sortSheetVisible.value = true;
}

function closeSortSheet() {
  sortSheetVisible.value = false;
  resetPlanSortDrag();
}

function handleSortSheetAfterClose() {
  sortSheetMounted.value = false;
  planSortRows.value = [];
  planSortScrollTop.value = 0;
}

function confirmSortSheet() {
  const ids = planSortRows.value.map(item => item.id).filter(isUuid);
  writePlanOrder(selectedDate.value, ids);
  closeSortSheet();
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
    const previousPlans = sortPlans(result.items, previousDate);
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

function openShoppingListPage() {
  closeEmptyDock();
  void uniPlatform.navigation.navigateTo("/pages_pantry/list/index");
}

function toggleEmptyDock() {
  if (!canShowPlanDock.value) return;
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
  if (action === "shopping") {
    openShoppingListPage();
    return;
  }
  openRecipe();
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

function visibleMenuItems(plan: MealPlanSummary) {
  return plan.menuItems.slice(0, 5);
}

function hasMoreMenuItems(plan: MealPlanSummary) {
  return plan.menuItems.length > 5;
}

function summarizeMenu(plan: MealPlanSummary) {
  return plan.menuItems
    .map(item => {
      const servingsText = item.servings ? `${item.servings}人份` : "";
      return servingsText ? `${item.title} - ${servingsText}` : item.title;
    })
    .join(" · ");
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
  const localDate = new Date(`${plan.planDate}T${mealSlotDefaultTime(plan.mealSlot)}:00`);
  const time = localDate.getTime();
  return Number.isFinite(time) ? time : 0;
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
    shoppingCreateName.value = buildDefaultListName();
  }
  shoppingSheetVisible.value = true;
}

async function createShoppingList() {
  if (shoppingSubmitting.value) return;
  shoppingSubmitting.value = true;
  try {
    const created = await shoppingListApi.createList({
      operationId: createOperationId(),
      name: shoppingCreateName.value.trim() || buildDefaultListName()
    });
    await loadShoppingLists(true);
    selectedShoppingListId.value = created.id;
    shoppingCreateName.value = buildDefaultListName();
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
    await shoppingListApi.addPlanToList(selectedShoppingListId.value, {
      operationId: createOperationId(),
      planItemId: shoppingPlan.value.id
    });
    closeShoppingSheet();
    await uniPlatform.feedback.toast({ title: "已加入采购清单", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "加入采购清单失败", icon: "none" });
  } finally {
    shoppingSubmitting.value = false;
  }
}

function sortPlans(items: MealPlanSummary[], date: string) {
  const order = planOrderMap.value[date] ?? [];
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((left, right) => {
    const leftIndex = orderMap.get(left.id);
    const rightIndex = orderMap.get(right.id);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return slotOrder(left.mealSlot) - slotOrder(right.mealSlot);
  });
}

function readPlanOrderState() {
  if (!sessionStore.uid) return {};
  return uniPlatform.storage.getSync<PlanOrderState>(buildPlanOrderStorageKey(sessionStore.uid)) ?? {};
}

function buildPlanOrderStorageKey(uid: number) {
  return `${PLAN_ORDER_STORAGE_KEY}/${uid}`;
}

function buildDefaultListName(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}月${day}日清单`;
}

function writePlanOrder(date: string, ids: UUID[]) {
  if (!sessionStore.uid) return;
  const nextState: PlanOrderState = {
    ...planOrderMap.value
  };
  if (ids.length > 1) {
    nextState[date] = dedupeIds(ids);
  } else {
    delete nextState[date];
  }
  planOrderMap.value = nextState;
  uniPlatform.storage.setSync(buildPlanOrderStorageKey(sessionStore.uid), nextState);
}

function clearPlanSortPressTimer() {
  if (!planSortPressTimer) return;
  clearTimeout(planSortPressTimer);
  planSortPressTimer = null;
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

function resetPlanSortDrag() {
  clearPlanSortPressTimer();
  planSortPressId = "";
  planSortPressTouchY = 0;
  planSortDraggingId.value = "";
  planSortGhostTop.value = 0;
  planSortStartTouchY.value = 0;
  planSortStartCardTop.value = 0;
}

function handlePlanSortScroll(event: Event) {
  const detail = (event as Event & { detail?: { scrollTop?: number } }).detail;
  planSortScrollTop.value = Number(detail?.scrollTop || 0);
}

function handlePlanSortTouchStart(planId: UUID, event: Event) {
  if (planSortDragging.value) return;
  const touchY = readTouchY(event);
  if (touchY === null) return;
  clearPlanSortPressTimer();
  planSortPressId = planId;
  planSortPressTouchY = touchY;
  planSortPressTimer = setTimeout(() => {
    planSortPressTimer = null;
    void activatePlanSortDrag(planSortPressId, planSortPressTouchY);
  }, PLAN_SORT_PRESS_DELAY_MS);
}

async function activatePlanSortDrag(planId: UUID | "", touchY: number) {
  if (!sortSheetVisible.value || !planId) return;
  const index = planSortRows.value.findIndex(item => item.id === planId);
  if (index < 0) return;

  const [scrollRect, rowRect] = await Promise.all([
    uniPlatform.system.measure("#plan-sort-scroll"),
    uniPlatform.system.measure(`#plan-sort-card-${planId}`)
  ]);
  if (scrollRect) {
    planSortListTop.value = scrollRect.top;
  }
  planSortDraggingId.value = planId;
  planSortCardLeft.value = rowRect?.left ?? planSortCardLeft.value;
  planSortCardWidth.value = rowRect?.width ?? planSortCardWidth.value;
  planSortCardHeight.value = rowRect?.height ?? planSortCardHeight.value;
  const rowSpan = resolvePlanSortRowSpan(
    planSortCardHeight.value,
    PLAN_SORT_GAP_RPX,
    uniPlatform.system.getWindowInfo()?.windowWidth
  );
  if (!rowSpan) {
    resetPlanSortDrag();
    return;
  }
  const fallbackTop = planSortListTop.value - planSortScrollTop.value + index * rowSpan;
  planSortStartTouchY.value = touchY;
  planSortStartCardTop.value = rowRect?.top ?? fallbackTop;
  planSortGhostTop.value = rowRect?.top ?? fallbackTop;
}

function handlePlanSortTouchMove(event: Event) {
  const touchY = readTouchY(event);
  if (!planSortDragging.value) {
    if (touchY !== null && planSortPressId && Math.abs(touchY - planSortPressTouchY) > PLAN_SORT_PRESS_MOVE_PX) {
      clearPlanSortPressTimer();
      planSortPressId = "";
    }
    return;
  }

  const rowSpan = resolvePlanSortRowSpan(
    planSortCardHeight.value,
    PLAN_SORT_GAP_RPX,
    uniPlatform.system.getWindowInfo()?.windowWidth
  );
  if (touchY === null || !rowSpan) return;

  const minTop = planSortListTop.value - planSortScrollTop.value;
  const maxTop = minTop + Math.max(0, (planSortRows.value.length - 1) * rowSpan);
  const nextTop = clampNumber(planSortStartCardTop.value + (touchY - planSortStartTouchY.value), minTop, maxTop);
  planSortGhostTop.value = nextTop;

  const currentIndex = planSortRows.value.findIndex(item => item.id === planSortDraggingId.value);
  if (currentIndex < 0) return;

  const centerY = nextTop - planSortListTop.value + planSortScrollTop.value + planSortCardHeight.value / 2;
  const targetIndex = clampNumber(Math.floor(centerY / rowSpan), 0, planSortRows.value.length - 1);
  if (targetIndex === currentIndex) return;

  planSortRows.value = movePlanRow(planSortRows.value, currentIndex, targetIndex);
}

function finishPlanSortDrag() {
  clearPlanSortPressTimer();
  planSortPressId = "";
  if (!planSortDragging.value) return;
  resetPlanSortDrag();
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
  planOrderMap.value = {};
  sortSheetMounted.value = false;
  sortSheetVisible.value = false;
  planSortRows.value = [];
  planSortScrollTop.value = 0;
  shoppingSheetVisible.value = false;
  shoppingListLoading.value = false;
  shoppingListError.value = "";
  shoppingLists.value = [];
  selectedShoppingListId.value = "";
  shoppingCreateName.value = "";
  shoppingSubmitting.value = false;
  shoppingPlan.value = null;
  emptyDockOpen.value = false;
  resetPlanSortDrag();
}

</script>

<style scoped lang="scss">
.plan-scroll {
  height: 100%;
}

.plan-page {
  --plan-card-radius: var(--radius-lg);
  --plan-card-bg: var(--color-surface);
  --plan-card-bg-soft: var(--color-surface-muted);
  --plan-card-border: color-mix(in srgb, var(--color-divider) 72%, transparent);
  --plan-card-shadow: var(--shadow-card);
  --plan-tag-bg: color-mix(in srgb, var(--color-surface-muted) 72%, var(--color-primary-soft) 28%);
  --plan-tag-text: var(--color-text-secondary);
  --plan-tag-accent-bg: color-mix(in srgb, var(--color-surface) 68%, var(--color-primary-soft) 32%);
  --plan-tag-accent-text: var(--color-primary);
  --plan-tag-done-bg: var(--color-success-soft);
  --plan-tag-done-text: var(--color-success);
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
  gap: 8rpx;
  min-height: 20rpx;
}

.week-day__dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 999rpx;
}

.week-day__dot--breakfast {
  background: var(--meal-slot-breakfast);
}

.week-day__dot--lunch {
  background: var(--meal-slot-lunch);
}

.week-day__dot--dinner {
  background: var(--meal-slot-dinner);
}

.week-day__extra {
  font-size: 18rpx;
  line-height: 1;
  color: var(--color-text-secondary);
}

.week-day--selected .week-day__number-shell {
  background: var(--color-primary);
}

.week-day--selected .week-day__number {
  color: var(--color-primary-foreground);
}

.week-day--selected .week-day__label {
  color: var(--color-primary);
}

.week-day--today:not(.week-day--selected) .week-day__number-shell {
  background: color-mix(in srgb, var(--meal-slot-dinner-soft) 62%, transparent);
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
  border: 1rpx solid var(--plan-card-border);
  border-radius: var(--plan-card-radius);
  background: var(--plan-card-bg);
  box-shadow: var(--plan-card-shadow);
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
  border: 1rpx solid var(--plan-card-border);
  border-radius: var(--radius-xs);
  background: linear-gradient(135deg, color-mix(in srgb, var(--plan-slot-soft) 84%, var(--color-surface)) 0%, var(--color-surface) 100%);
  box-shadow: var(--plan-card-shadow);
}

.meal-card::before {
  content: "";
  position: absolute;
  top: 16rpx;
  left: 18rpx;
  bottom: 0;
  width: 176rpx;
  border-radius: 32rpx 0 0 32rpx;
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--plan-slot-color) 10%, var(--color-surface)) 0%, var(--plan-slot-soft) 100%);
  box-shadow: inset 0 0 0 1rpx color-mix(in srgb, var(--plan-slot-color) 6%, transparent);
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
  --plan-slot-color: var(--meal-slot-breakfast);
  --plan-slot-soft: var(--meal-slot-breakfast-soft);
  --plan-slot-band-pattern:
    radial-gradient(circle at 28% 28%, color-mix(in srgb, var(--plan-slot-color) 13%, transparent) 0 18%, transparent 19%),
    radial-gradient(circle at 46% 18%, color-mix(in srgb, var(--plan-slot-color) 10%, transparent) 0 14%, transparent 15%),
    radial-gradient(circle at 62% 38%, color-mix(in srgb, var(--plan-slot-color) 9%, transparent) 0 13%, transparent 14%),
    radial-gradient(circle at 54% 70%, color-mix(in srgb, var(--plan-slot-color) 7%, transparent) 0 16%, transparent 17%);
  --plan-slot-panel-bg:
    radial-gradient(circle at 10% 20%, color-mix(in srgb, var(--color-surface) 88%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 74% 24%, color-mix(in srgb, var(--meal-slot-breakfast) 5%, transparent) 0 14%, transparent 15%),
    radial-gradient(circle at 58% 82%, color-mix(in srgb, var(--meal-slot-breakfast) 4%, transparent) 0 16%, transparent 17%);
}

.meal-card--lunch {
  --plan-slot-color: var(--meal-slot-lunch);
  --plan-slot-soft: var(--meal-slot-lunch-soft);
  --plan-slot-band-pattern:
    radial-gradient(circle at 32% 72%, color-mix(in srgb, var(--plan-slot-color) 12%, transparent) 0 18%, transparent 19%),
    radial-gradient(circle at 68% 58%, color-mix(in srgb, var(--plan-slot-color) 9%, transparent) 0 14%, transparent 15%),
    radial-gradient(circle at 70% 20%, color-mix(in srgb, var(--plan-slot-color) 8%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 20% 38%, color-mix(in srgb, var(--plan-slot-color) 6%, transparent) 0 12%, transparent 13%);
  --plan-slot-panel-bg:
    radial-gradient(circle at 84% 16%, color-mix(in srgb, var(--color-surface) 88%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 28% 72%, color-mix(in srgb, var(--meal-slot-lunch) 5%, transparent) 0 16%, transparent 17%),
    radial-gradient(circle at 54% 36%, color-mix(in srgb, var(--meal-slot-lunch) 4%, transparent) 0 13%, transparent 14%);
}

.meal-card--dinner {
  --plan-slot-color: var(--meal-slot-dinner);
  --plan-slot-soft: var(--meal-slot-dinner-soft);
  --plan-slot-band-pattern:
    radial-gradient(circle at 72% 24%, color-mix(in srgb, var(--plan-slot-color) 12%, transparent) 0 18%, transparent 19%),
    radial-gradient(circle at 46% 48%, color-mix(in srgb, var(--plan-slot-color) 9%, transparent) 0 14%, transparent 15%),
    radial-gradient(circle at 24% 72%, color-mix(in srgb, var(--plan-slot-color) 7%, transparent) 0 13%, transparent 14%),
    radial-gradient(circle at 62% 78%, color-mix(in srgb, var(--plan-slot-color) 5%, transparent) 0 12%, transparent 13%);
  --plan-slot-panel-bg:
    radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--color-surface) 88%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 22% 74%, color-mix(in srgb, var(--meal-slot-dinner) 5%, transparent) 0 16%, transparent 17%),
    radial-gradient(circle at 58% 42%, color-mix(in srgb, var(--meal-slot-dinner) 4%, transparent) 0 13%, transparent 14%);
}

.meal-card--extra {
  --plan-slot-color: var(--meal-slot-extra);
  --plan-slot-soft: var(--meal-slot-extra-soft);
  --plan-slot-band-pattern:
    radial-gradient(circle at 24% 26%, color-mix(in srgb, var(--plan-slot-color) 11%, transparent) 0 16%, transparent 17%),
    radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--plan-slot-color) 8%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 74% 70%, color-mix(in srgb, var(--plan-slot-color) 8%, transparent) 0 15%, transparent 16%),
    radial-gradient(circle at 38% 74%, color-mix(in srgb, var(--plan-slot-color) 6%, transparent) 0 12%, transparent 13%);
  --plan-slot-panel-bg:
    radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--color-surface) 88%, transparent) 0 12%, transparent 13%),
    radial-gradient(circle at 80% 72%, color-mix(in srgb, var(--meal-slot-extra) 5%, transparent) 0 16%, transparent 17%),
    radial-gradient(circle at 56% 38%, color-mix(in srgb, var(--meal-slot-extra) 4%, transparent) 0 13%, transparent 14%);
}

.meal-card__event-badge {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 3;
  max-width: 220rpx;
  padding: 10rpx 18rpx;
  border-radius: 0 0 0 var(--radius-xs);
  color: var(--color-primary-foreground);
  font-size: 20rpx;
  line-height: 1;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: 0 14rpx 28rpx color-mix(in srgb, var(--color-primary-soft) 72%, transparent);
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
  background: var(--plan-tag-done-bg);
  color: var(--plan-tag-done-text);
  font-size: 20rpx;
}

.meal-card__slot {
  flex: 0 0 auto;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--plan-slot-color) 14%, var(--color-surface));
  color: var(--plan-slot-color);
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
  border-bottom: 2rpx dashed color-mix(in srgb, var(--plan-slot-color) 22%, var(--color-divider));
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

.shopping-list-grid {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.shopping-list-option {
  padding: 20rpx 22rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.78);
}

.shopping-list-option--active {
  border-color: rgba(47, 111, 78, 0.22);
  background: rgba(47, 111, 78, 0.08);
}

.shopping-list-option__title,
.shopping-list-option__meta {
  display: block;
}

.shopping-list-option__title {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.shopping-list-option__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.shopping-create {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.shopping-create__input {
  flex: 1;
  min-width: 0;
  height: 76rpx;
  padding: 0 22rpx;
  border: 1rpx solid rgba(109, 92, 72, 0.1);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-sizing: border-box;
  color: var(--color-text);
  font-size: 26rpx;
}

.shopping-create__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 132rpx;
  height: 76rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
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
  min-height: 88rpx;
  height: 88rpx;
  border: 0;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button::after {
  border: 0;
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.sheet-actions__button--cancel {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
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
  background: color-mix(in srgb, var(--color-surface) 96%, white 4%);
  box-shadow:
    0 18rpx 34rpx color-mix(in srgb, var(--color-primary-soft) 30%, transparent),
    0 8rpx 18rpx color-mix(in srgb, var(--color-primary) 12%, transparent),
    inset 0 0 0 1rpx color-mix(in srgb, var(--color-surface) 85%, transparent);
  color: var(--color-text);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(26rpx) scale(0.92);
  pointer-events: none;
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
  color: color-mix(in srgb, var(--color-text) 84%, var(--color-primary) 16%);
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
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

.plan-sort {
  min-height: 240rpx;
}

.plan-sort__summary {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 8rpx 0 18rpx;
}

.plan-sort__summary-date {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-sort__summary-count {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.plan-sort__scroll {
  max-height: 760rpx;
}

.plan-sort__list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 8rpx;
}

.plan-sort-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-surface) 92%, var(--color-page) 8%);
  border: 2rpx solid color-mix(in srgb, var(--color-border) 76%, transparent);
  box-shadow: var(--shadow-card);
}

.plan-sort-card--placeholder {
  opacity: 0.18;
}

.plan-sort-card--ghost {
  box-shadow: 0 22rpx 56rpx color-mix(in srgb, var(--color-primary-soft) 62%, transparent);
}

.plan-sort-card__order {
  flex: 0 0 auto;
  width: 68rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.plan-sort-card__main {
  flex: 1;
  min-width: 0;
}

.plan-sort-card__title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.plan-sort-card__title {
  flex: 1;
  min-width: 0;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
}

.plan-sort-card__slot {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-primary-soft) 42%, var(--color-surface));
  color: var(--color-primary);
  font-size: 20rpx;
}

.plan-sort-card__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.plan-sort-card__drag {
  flex: 0 0 auto;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.plan-sort-card__drag--ghost {
  color: var(--color-primary);
}

.plan-sort__footer {
  display: flex;
  gap: 16rpx;
  margin: 8rpx 0 24rpx;
}

.plan-sort__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 96rpx;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.plan-sort__button--ghost {
  background: color-mix(in srgb, var(--color-primary-soft) 42%, var(--color-surface));
  color: var(--color-primary);
}

.plan-sort__button--primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--color-primary-foreground);
}

.plan-sort__ghost {
  position: fixed;
  z-index: 1300;
}
</style>
