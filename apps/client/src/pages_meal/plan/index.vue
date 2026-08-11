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
                    <view v-for="dotIndex in day.dotCount" :key="`${day.date}-${dotIndex}`" class="week-day__dot" />
                  </view>
                </view>
              </view>
            </swiper-item>
          </swiper>
        </view>

        <view class="plan-scroll-wrap">
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
              <view class="day-head">
                <view class="day-head__main">
                  <text class="day-head__title">{{ selectedDateTitle }}</text>
                  <text v-if="!selectedPlanCount" class="day-head__subtitle">先给这一天定下一顿，再决定要不要发起饭局。</text>
                </view>
              </view>

              <view v-if="errorText" class="notice" @click="reloadWeek">
                {{ errorText }}
              </view>
              <view v-else-if="loading && !refreshing" class="notice">正在同步这一周的计划...</view>

              <view v-if="!recipeOptions.length && !loadingRecipes" class="recipe-empty">
                <Empty title="还没有我的菜谱" description="先去菜谱页准备几道常做菜，再回来安排这一周。" />
                <view class="recipe-empty__action" hover-class="recipe-empty__action--hover" hover-stay-time="100" @click="openRecipeHome">
                  去我的菜谱
                </view>
              </view>

              <view v-else-if="!selectedPlanCount" class="day-empty">
                <text class="day-empty__title">这一天还没有安排</text>
                <text class="day-empty__desc">先给这一天加一条安排，或者把上周同一天的安排带过来。</text>
                <view class="day-empty__actions">
                  <view
                    class="day-empty__action action-pill action-pill--primary"
                    hover-class="action-pill--hover"
                    hover-stay-time="100"
                    @click="openCreateEditor()"
                  >
                    添加安排
                  </view>
                  <view
                    class="day-empty__action action-pill action-pill--muted action-pill--subtle"
                    :class="copyBusy ? 'day-empty__action--disabled' : ''"
                    hover-class="action-pill--hover"
                    hover-stay-time="100"
                    @click="copyPreviousWeek"
                  >
                    {{ copyBusy ? "复制中..." : "复制上周计划" }}
                  </view>
                  <view
                    class="day-empty__action action-pill action-pill--muted action-pill--subtle"
                    hover-class="action-pill--hover"
                    hover-stay-time="100"
                    @click="openRecipeHome"
                  >
                    看看我的菜谱
                  </view>
                </view>
              </view>

              <view class="meal-list">
                <view v-for="plan in selectedPlans" :key="plan.id" class="meal-card">
                  <view class="meal-card__head">
                    <view class="meal-card__label-row">
                      <text class="meal-card__slot-badge">{{ slotLabel(plan.mealSlot) }}</text>
                      <text class="meal-card__tag">{{ plan.menuItems.length }}道菜</text>
                      <text v-if="plan.hasDiningEvent" class="meal-card__tag meal-card__tag--accent">
                        {{ planDiningText(plan) }}
                      </text>
                      <text v-if="plan.status === 'COMPLETED'" class="meal-card__tag meal-card__tag--done">已完成</text>
                    </view>
                  </view>

                  <view class="meal-card__body">
                    <view class="meal-card__menu-panel">
                      <text class="meal-card__panel-label">菜单安排</text>
                      <view class="meal-card__menu-list">
                        <view
                          v-for="item in plan.menuItems"
                          :key="`${plan.id}-${item.recipeVersionId}`"
                          :class="['meal-card__menu-chip', item.recipeId ? 'meal-card__menu-chip--link' : '']"
                          :hover-class="item.recipeId ? 'meal-card__menu-chip--hover' : ''"
                          hover-stay-time="100"
                          @click="openRecipeDetail(item.recipeId)"
                        >
                          <text class="meal-card__menu-name">{{ item.title }}</text>
                          <view class="meal-card__menu-line" />
                          <text v-if="item.servings" class="meal-card__menu-count">{{ item.servings }}人份</text>
                        </view>
                      </view>
                    </view>
                  </view>

                  <view class="meal-card__actions">
                    <view
                      v-if="plan.hasDiningEvent && plan.diningEventId"
                      class="action-pill action-pill--muted action-pill--subtle"
                      hover-class="action-pill--hover"
                      hover-stay-time="100"
                      @click="openEventDetail(plan)"
                    >
                      查看饭局
                    </view>
                    <view
                      v-else-if="plan.status !== 'COMPLETED'"
                      class="action-pill action-pill--muted action-pill--subtle"
                      hover-class="action-pill--hover"
                      hover-stay-time="100"
                      @click="openEventCreate(plan)"
                    >
                      发起饭局
                    </view>
                    <view
                      v-if="plan.status !== 'COMPLETED'"
                      class="action-pill action-pill--muted"
                      hover-class="action-pill--hover"
                      hover-stay-time="100"
                      @click="openEditor(plan.mealSlot, plan)"
                    >
                      调整菜谱
                    </view>
                    <view
                      v-if="plan.status !== 'COMPLETED'"
                      class="action-pill action-pill--primary"
                      hover-class="action-pill--hover"
                      hover-stay-time="100"
                      @click="markPlanDone(plan)"
                    >
                      标记完成
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>

      <view class="floating-fab">
        <view v-if="fabExpanded" class="floating-fab__backdrop" @click="closeFab" />
        <view class="floating-fab__cluster">
          <view
            v-for="(item, index) in fabActionItems"
            :key="item.key"
            class="floating-fab__item"
            :class="[`floating-fab__item--${item.tone}`, { 'floating-fab__item--expanded': fabExpanded }]"
            :style="buildFabActionStyle(index, fabActionItems.length)"
            @click="handleFabAction(item.key)"
          >
            <text class="floating-fab__item-label">{{ item.label }}</text>
          </view>

          <view class="floating-fab__trigger" :class="{ 'floating-fab__trigger--expanded': fabExpanded }" @click="toggleFab">
            <text class="cookfont icon-add floating-fab__trigger-icon" />
          </view>
        </view>
      </view>

      <SheetShell
        v-if="sheetMounted"
        :visible="sheetVisible"
        :title="sheetTitle"
        :subtitle="sheetSubtitle"
        @close="closeSheet"
        @after-close="handleSheetAfterClose"
      >
        <template #title-extra>
          <text class="sheet-count">{{ selectedRecipeIds.length }}道</text>
        </template>

        <view class="editor-sheet">
          <view class="editor-sheet__summary">
            <text class="editor-sheet__summary-date">{{ selectedDateTitle }}</text>
            <text class="editor-sheet__summary-slot">{{ slotLabel(editingSlot) }}</text>
          </view>

          <view v-if="!editingPlanId" class="editor-sheet__section">
            <text class="editor-sheet__section-label">这条安排是</text>
            <view class="editor-sheet__slot-row">
              <view
                v-for="item in editorSlotOptions"
                :key="item.value"
                :class="['editor-sheet__slot', editingSlot === item.value ? 'editor-sheet__slot--active' : '']"
                @click="editingSlot = item.value"
              >
                {{ item.label }}
              </view>
            </view>
          </view>

          <view v-if="!recipeOptions.length" class="editor-sheet__empty">
            <Empty title="还没有可安排的菜谱" description="先去“我的菜谱”创建几道常做菜，再回来安排这一餐。" />
            <view class="editor-sheet__empty-action" hover-class="editor-sheet__empty-action--hover" hover-stay-time="100" @click="openRecipeHome">
              去我的菜谱
            </view>
          </view>

          <view v-else class="editor-sheet__list">
            <view
              v-for="recipe in recipeOptions"
              :key="recipe.id"
              :class="['recipe-option', isRecipeSelected(recipe.id) ? 'recipe-option--selected' : '']"
              hover-class="recipe-option--hover"
              hover-stay-time="100"
              @click="toggleRecipe(recipe.id)"
            >
              <image v-if="recipe.coverImageUrl" class="recipe-option__cover" :src="recipe.coverImageUrl" mode="aspectFill" />
              <view v-else class="recipe-option__cover recipe-option__cover--empty">
                <text class="recipe-option__cover-text">菜谱</text>
              </view>

              <view class="recipe-option__main">
                <text class="recipe-option__name">{{ recipe.title }}</text>
                <text class="recipe-option__meta">
                  {{ [recipe.difficultyText, recipe.durationText].filter(Boolean).join(" · ") || "先加入这顿饭，后续再细调" }}
                </text>
              </view>

              <view class="recipe-option__check">
                <view :class="['recipe-option__check-dot', isRecipeSelected(recipe.id) ? 'recipe-option__check-dot--selected' : '']" />
              </view>
            </view>
          </view>
        </view>

        <template #footer>
          <view
            :class="[
              'editor-submit',
              submitting || !selectedRecipeIds.length || !recipeOptions.length ? 'editor-submit--disabled' : ''
            ]"
            @click="submitPlan"
          >
            {{ submitting ? "保存中..." : editingPlanId ? "保存这顿饭" : "安排这顿饭" }}
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
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, nextTick, ref, watch } from "vue";
import { type UUID } from "@/apis/http";
import { recipeApi, type MyRecipeSummary } from "@/apis/recipe";
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
import { dedupeIds, isUuid, parseQueryId } from "../utils/id";
import { getPlanSortRowSpan as resolvePlanSortRowSpan, movePlanRow } from "../utils/plan";

type MealSlot = "BREAKFAST" | "LUNCH" | "DINNER";
type FabActionKey = "create" | "copy" | "sort" | "recipe";
type FabActionTone = "primary" | "surface" | "warning";

interface WeekPanelDay {
  date: string;
  label: string;
  dayNumber: string;
  isToday: boolean;
  isSelected: boolean;
  dotCount: number;
}

interface WeekPanel {
  key: string;
  days: WeekPanelDay[];
}

type PlanOrderState = Record<string, UUID[]>;

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
const FAB_ACTION_POINT_MAP: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: -208, y: -28 }],
  2: [
    { x: -198, y: -48 },
    { x: -56, y: -204 }
  ],
  3: [
    { x: -224, y: -18 },
    { x: -148, y: -126 },
    { x: -32, y: -214 }
  ],
  4: [
    { x: -230, y: -16 },
    { x: -190, y: -92 },
    { x: -118, y: -170 },
    { x: -26, y: -226 }
  ]
};
const PLAN_LOADING_TIPS = ["刷新这一周安排", "把最近的做饭计划拉下来", "看看这周有没有新安排"];
const recipeOptions = ref<MyRecipeSummary[]>([]);
const plans = ref<MealPlanSummary[]>([]);
const loading = ref(false);
const loadingRecipes = ref(false);
const submitting = ref(false);
const copyBusy = ref(false);
const errorText = ref("");
const selectedDate = ref(today);
const weekSwiperCurrent = ref(WEEK_PANEL_MID);
const weekSwiperDuration = ref(WEEK_SWIPER_DURATION_MS);
const previewDate = ref("");
const loadedOnce = ref(false);
const planLoadSeq = ref(0);
const sheetMounted = ref(false);
const sheetVisible = ref(false);
const editingSlot = ref<MealSlot>("DINNER");
const editingPlanId = ref<UUID | "">("");
const selectedRecipeIds = ref<UUID[]>([]);
const pendingRecipeId = ref<UUID | "">("");
const recipeQueryHandled = ref(false);
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
const fabExpanded = ref(false);
const planSortDraggingId = ref<UUID | "">("");
const planSortListTop = ref(0);
const planSortCardLeft = ref(0);
const planSortCardWidth = ref(0);
const planSortCardHeight = ref(0);
const planSortGhostTop = ref(0);
const planSortStartTouchY = ref(0);
const planSortStartCardTop = ref(0);
const planSortScrollTop = ref(0);
let planSortPressTimer: ReturnType<typeof setTimeout> | null = null;
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

const MEAL_SLOTS: Array<{ value: MealSlot; label: string }> = [
  { value: "BREAKFAST", label: "早餐" },
  { value: "LUNCH", label: "午餐" },
  { value: "DINNER", label: "晚餐" }
];
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
const canSortPlans = computed(() => selectedPlanCount.value > 1);
const availableSlots = computed(() => MEAL_SLOTS.filter(item => !selectedDatePlanMap.value.has(item.value)));
const canAddPlan = computed(() => availableSlots.value.length > 0);
const editorSlotOptions = computed(() => (editingPlanId.value ? MEAL_SLOTS.filter(item => item.value === editingSlot.value) : availableSlots.value));
const hasContentCards = computed(() => Boolean(errorText.value || selectedPlanCount.value || !recipeOptions.value.length || loading.value));
const inlineLoading = computed(() => loading.value && hasContentCards.value && !refreshing.value);
const inlineLoadingText = computed(() => PLAN_LOADING_TIPS);

const weekPanels = computed<WeekPanel[]>(() => {
  return weekPanelStarts.value.map(weekStart => buildWeekPanel(weekStart));
});
const fabActionItems = computed<Array<{ key: FabActionKey; label: string; tone: FabActionTone }>>(() => {
  const items: Array<{ key: FabActionKey; label: string; tone: FabActionTone }> = [];
  if (canAddPlan.value) {
    items.push({ key: "create", label: "添加安排", tone: "primary" });
  }
  items.push({
    key: "copy",
    label: copyBusy.value ? "复制中..." : "复制上周",
    tone: copyBusy.value ? "warning" : "surface"
  });
  if (canSortPlans.value) {
    items.push({ key: "sort", label: "调整顺序", tone: "surface" });
  }
  items.push({ key: "recipe", label: "去看菜谱", tone: "surface" });
  return items;
});

const sheetTitle = computed(() => (editingPlanId.value ? "调整这顿饭" : "安排这顿饭"));
const sheetSubtitle = computed(() =>
  editingPlanId.value ? "保存后会整体覆盖这顿饭当前菜单。" : "从“我的菜谱”里多选几道，先把这一餐定下来。"
);
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
  const nextRecipeId = parseQueryId(query?.recipeId);
  if (nextRecipeId) {
    pendingRecipeId.value = nextRecipeId;
  }
});

onShow(() => {
  if (!sessionStore.isLoggedIn) return;
  void loadPage();
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

watch(
  () => sheetVisible.value,
  visible => {
    if (visible) {
      fabExpanded.value = false;
    }
  }
);

watch(
  () => sortSheetVisible.value,
  visible => {
    if (visible) {
      fabExpanded.value = false;
    }
  }
);

async function loadPage() {
  planOrderMap.value = readPlanOrderState();
  await Promise.all([loadRecipeOptions(), loadWeekPlans()]);
  loadedOnce.value = true;
  void handlePendingRecipeIntent();
}

async function loadRecipeOptions() {
  if (!sessionStore.isLoggedIn || loadingRecipes.value) return;
  loadingRecipes.value = true;
  try {
    let page = 1;
    let hasNext = true;
    const items: MyRecipeSummary[] = [];
    while (hasNext) {
      const result = await recipeApi.listMyRecipes({ page, pageSize: 100 });
      items.push(...result.items);
      hasNext = result.hasNext;
      page += 1;
    }
    recipeOptions.value = items;
    selectedRecipeIds.value = selectedRecipeIds.value.filter(id => items.some(recipe => recipe.id === id));
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "菜谱加载失败", icon: "none" });
  } finally {
    loadingRecipes.value = false;
  }
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
    errorText.value = error instanceof Error ? error.message : "本周计划加载失败，点此重试";
  } finally {
    if (seq === planLoadSeq.value) {
      loading.value = false;
    }
  }
}

async function handleRefresherRefresh() {
  if (!onRefresherRefresh()) return;
  try {
    await Promise.all([loadRecipeOptions(), loadWeekPlans()]);
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
      return {
        date: dateText,
        label: WEEKDAY_LABELS[index],
        dayNumber: `${date.getDate()}`,
        isToday: dateText === today,
        isSelected: dateText === activeWeekDate.value,
        dotCount: planMap.value.get(dateText)?.size ?? 0
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

function openCreateEditor(preferredSlot: MealSlot | null = "DINNER", extraRecipeIds: UUID[] = []) {
  closeFab();
  if (!recipeOptions.value.length) {
    openRecipeHome();
    return;
  }
  const nextSlot = resolvePreferredSlot(preferredSlot);
  if (!nextSlot) {
    void uniPlatform.feedback.toast({ title: "这一天的安排已经排满了", icon: "none" });
    return;
  }
  openEditor(nextSlot, null, extraRecipeIds);
}

function openEditor(slot: MealSlot, plan: MealPlanSummary | null = null, extraRecipeIds: UUID[] = []) {
  editingSlot.value = plan?.mealSlot ?? slot;
  editingPlanId.value = plan?.id ?? "";
  const existingIds = plan ? plan.menuItems.map(item => item.recipeId).filter(isUuid) : [];
  selectedRecipeIds.value = dedupeRecipeIds([...existingIds, ...extraRecipeIds]);
  sheetMounted.value = true;
  nextTick(() => {
    sheetVisible.value = true;
  });
}

function closeSheet() {
  sheetVisible.value = false;
}

function handleSheetAfterClose() {
  sheetMounted.value = false;
  selectedRecipeIds.value = [];
  editingPlanId.value = "";
}

async function openSortSheet() {
  closeFab();
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

function toggleRecipe(recipeId: UUID) {
  const exists = selectedRecipeIds.value.includes(recipeId);
  selectedRecipeIds.value = exists
    ? selectedRecipeIds.value.filter(id => id !== recipeId)
    : sortRecipeIdsByOption([...selectedRecipeIds.value, recipeId]);
}

function isRecipeSelected(recipeId: UUID) {
  return selectedRecipeIds.value.includes(recipeId);
}

async function submitPlan() {
  if (!selectedRecipeIds.value.length || submitting.value) return;
  submitting.value = true;
  try {
    await mealApi.createPlan({
      operationId: createOperationId(),
      planDate: selectedDate.value,
      mealSlot: editingSlot.value,
      recipeIds: selectedRecipeIds.value
    });
    await uniPlatform.feedback.toast({ title: editingPlanId.value ? "这顿饭已更新" : "这顿饭已安排", icon: "success" });
    closeSheet();
    await loadWeekPlans();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function markPlanDone(plan: MealPlanSummary) {
  if (submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "标记完成",
    content: `确认把${slotLabel(plan.mealSlot)}这顿饭标记为已完成吗？`
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    await mealApi.completePlan(plan.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "已标记完成", icon: "success" });
    await loadWeekPlans();
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function copyPreviousWeek() {
  if (copyBusy.value) return;
  const previousWeekStart = addDays(selectedWeekStart.value, -7);

  copyBusy.value = true;
  try {
    const result = await listWeekPlans(previousWeekStart);
    const currentPlanMap = planMap.value;
    const copyCandidates = result.items.filter(item => {
      const targetDate = formatDateOnly(addDays(parseDateOnly(item.planDate), 7));
      if (currentPlanMap.get(targetDate)?.has(item.mealSlot)) return false;
      return item.menuItems.every(menuItem => isUuid(menuItem.recipeId));
    });

    const skippedExisting = result.items.filter(item => {
      const targetDate = formatDateOnly(addDays(parseDateOnly(item.planDate), 7));
      return Boolean(currentPlanMap.get(targetDate)?.has(item.mealSlot));
    }).length;
    const skippedInvalid = result.items.length - skippedExisting - copyCandidates.length;

    if (!result.items.length) {
      await uniPlatform.feedback.toast({ title: "上周没有可复制的计划", icon: "none" });
      return;
    }

    if (!copyCandidates.length) {
      const summary = buildCopySummary(0, skippedExisting, skippedInvalid);
      await uniPlatform.feedback.toast({ title: summary, icon: "none" });
      return;
    }

    const confirmed = await uniPlatform.feedback.confirm({
      title: "复制上周计划",
      content: buildCopyConfirm(copyCandidates.length, skippedExisting, skippedInvalid)
    });
    if (!confirmed) return;

    for (const item of copyCandidates) {
      const targetDate = formatDateOnly(addDays(parseDateOnly(item.planDate), 7));
      const recipeIds = item.menuItems.map(menuItem => menuItem.recipeId).filter(isUuid);
      if (!recipeIds.length) continue;
      await mealApi.createPlan({
        operationId: createOperationId(),
        planDate: targetDate,
        mealSlot: item.mealSlot,
        recipeIds
      });
    }

    await loadWeekPlans();
    await uniPlatform.feedback.toast({ title: buildCopySummary(copyCandidates.length, skippedExisting, skippedInvalid), icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "复制失败", icon: "none" });
  } finally {
    copyBusy.value = false;
  }
}

function openRecipeHome() {
  closeFab();
  void uniPlatform.navigation.switchTab("/pages/recipe/index");
}

function openRecipeDetail(recipeId: UUID | null) {
  if (!isUuid(recipeId)) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=my`);
}

function openEventCreate(plan: MealPlanSummary) {
  const title = encodeURIComponent(plan.title);
  const planDate = encodeURIComponent(plan.planDate);
  const mealSlot = encodeURIComponent(plan.mealSlot);
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/event/index?planItemId=${encodeURIComponent(String(plan.id))}&planDate=${planDate}&mealSlot=${mealSlot}&title=${title}`
  );
}

function openEventDetail(plan: MealPlanSummary) {
  if (!plan.diningEventId) return;
  const title = encodeURIComponent(plan.title);
  const planDate = encodeURIComponent(plan.planDate);
  const mealSlot = encodeURIComponent(plan.mealSlot);
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/event/index?eventId=${encodeURIComponent(String(plan.diningEventId))}&planItemId=${encodeURIComponent(String(plan.id))}&planDate=${planDate}&mealSlot=${mealSlot}&title=${title}`
  );
}

function reloadWeek() {
  void loadWeekPlans();
}

function summarizeMenu(plan: MealPlanSummary) {
  return plan.menuItems.map(item => item.title).join(" · ");
}

function planDiningText(plan: MealPlanSummary) {
  return "已关联饭局";
}

function slotLabel(slot: MealSlot) {
  return MEAL_SLOTS.find(item => item.value === slot)?.label || "这顿饭";
}

async function handlePendingRecipeIntent() {
  if (recipeQueryHandled.value || !pendingRecipeId.value) return;
  const recipeId = pendingRecipeId.value;
  recipeQueryHandled.value = true;
  pendingRecipeId.value = "";
  if (!recipeOptions.value.some(item => item.id === recipeId)) return;
  if (selectedDatePlanMap.value.get("DINNER")) {
    openEditor("DINNER", selectedDatePlanMap.value.get("DINNER") ?? null, [recipeId]);
    return;
  }
  openCreateEditor("DINNER", [recipeId]);
}

function sortRecipeIdsByOption(ids: UUID[]) {
  const orderMap = new Map(recipeOptions.value.map((item, index) => [item.id, index]));
  return dedupeRecipeIds(ids).sort((left, right) => (orderMap.get(left) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(right) ?? Number.MAX_SAFE_INTEGER));
}

function dedupeRecipeIds(ids: UUID[]) {
  return Array.from(new Set(ids.filter(isUuid)));
}

function resolvePreferredSlot(preferredSlot: MealSlot | null) {
  if (preferredSlot && availableSlots.value.some(item => item.value === preferredSlot)) {
    return preferredSlot;
  }
  return availableSlots.value[0]?.value ?? null;
}

function slotOrder(slot: MealSlot) {
  if (slot === "BREAKFAST") return 0;
  if (slot === "LUNCH") return 1;
  return 2;
}

function buildCopyConfirm(copiedCount: number, skippedExisting: number, skippedInvalid: number) {
  const parts = [`会把上周 ${copiedCount} 个空餐次带到这一周。`];
  if (skippedExisting) {
    parts.push(`已有安排的 ${skippedExisting} 个餐次会跳过。`);
  }
  if (skippedInvalid) {
    parts.push(`缺少有效菜谱引用的 ${skippedInvalid} 个旧餐次也会跳过。`);
  }
  return parts.join("");
}

function buildCopySummary(copiedCount: number, skippedExisting: number, skippedInvalid: number) {
  const parts = [`已复制 ${copiedCount} 餐`];
  if (skippedExisting) {
    parts.push(`跳过已有 ${skippedExisting} 餐`);
  }
  if (skippedInvalid) {
    parts.push(`跳过旧数据 ${skippedInvalid} 餐`);
  }
  return parts.join("，");
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

function toggleFab() {
  fabExpanded.value = !fabExpanded.value;
}

function closeFab() {
  fabExpanded.value = false;
}

function handleFabAction(key: FabActionKey) {
  if (key === "create") {
    openCreateEditor();
    return;
  }
  if (key === "copy") {
    if (copyBusy.value) return;
    closeFab();
    void copyPreviousWeek();
    return;
  }
  if (key === "sort") {
    if (!canSortPlans.value) return;
    void openSortSheet();
    return;
  }
  openRecipeHome();
}

function buildFabActionStyle(index: number, total: number) {
  const points = FAB_ACTION_POINT_MAP[total] ?? FAB_ACTION_POINT_MAP[4];
  const point = points?.[index] ?? points?.[points.length - 1] ?? { x: -208, y: -28 };
  const delay = index * 90;
  return `--fab-x: ${point.x}rpx; --fab-y: ${point.y}rpx; --fab-delay: ${delay}ms;`;
}

function clearPageState() {
  recipeOptions.value = [];
  plans.value = [];
  loading.value = false;
  loadingRecipes.value = false;
  submitting.value = false;
  copyBusy.value = false;
  errorText.value = "";
  selectedDate.value = today;
  selectedRecipeIds.value = [];
  editingPlanId.value = "";
  sheetVisible.value = false;
  sheetMounted.value = false;
  loadedOnce.value = false;
  previewDate.value = "";
  weekRangeStart.value = buildWeekRangeStart(startOfWeek(parseDateOnly(today)), WEEK_PANEL_MID);
  weekPanelOverride.value = null;
  weekSilentReset.value = false;
  monthTransition.value = null;
  weekSwiperCurrent.value = WEEK_PANEL_MID;
  weekSwiperDuration.value = WEEK_SWIPER_DURATION_MS;
  fabExpanded.value = false;
  planOrderMap.value = {};
  sortSheetMounted.value = false;
  sortSheetVisible.value = false;
  planSortRows.value = [];
  planSortScrollTop.value = 0;
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
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.plan-scroll__body {
  min-height: 100%;
  padding: 16rpx var(--space-page) 48rpx;
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
  border-radius: 999rpx;
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
  margin-top: 12rpx;
}

.week-day__dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(244, 108, 83, 0.55);
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
  background: rgba(244, 108, 83, 0.1);
}

.day-head {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.day-head__main {
  min-width: 0;
  flex: 1;
}

.day-head__title {
  display: block;
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: var(--font-weight-heavy);
}

.day-head__subtitle {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.day-empty__action--disabled {
  opacity: 0.54;
}

.notice,
.day-empty,
.recipe-empty,
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

.recipe-empty {
  margin-top: 24rpx;
  padding: 24rpx;
}

.day-empty {
  margin-top: 24rpx;
  padding: 28rpx;
}

.day-empty__title {
  display: block;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
}

.day-empty__desc {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.day-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 24rpx;
}

.day-empty__action {
  min-width: 188rpx;
}

.recipe-empty__action,
.editor-sheet__empty-action {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  padding: 24rpx;
  border-radius: var(--radius-md);
  background: var(--plan-tag-accent-bg);
  color: var(--color-primary);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.recipe-empty__action--hover,
.editor-sheet__empty-action--hover {
  transform: scale(0.99);
}

.meal-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 24rpx;
}

.meal-card {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 28rpx;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.meal-card__head {
  display: block;
}

.meal-card__body {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.meal-card__label-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.meal-card__slot-badge {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--plan-tag-bg);
  color: var(--plan-tag-text);
  font-size: 20rpx;
}

.meal-card__tag {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--plan-tag-bg);
  color: var(--plan-tag-text);
  font-size: 20rpx;
}

.meal-card__tag--accent {
  background: var(--plan-tag-accent-bg);
  color: var(--plan-tag-accent-text);
}

.meal-card__tag--done {
  background: var(--plan-tag-done-bg);
  color: var(--plan-tag-done-text);
}

.meal-card__menu-panel {
  padding: 22rpx 24rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.meal-card__panel-label {
  display: block;
  margin-bottom: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.meal-card__menu-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.meal-card__menu-chip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-card__menu-chip--link {
  cursor: pointer;
}

.meal-card__menu-chip--hover {
  opacity: 0.82;
}

.meal-card__menu-name,
.meal-card__menu-count {
  display: block;
  flex: 0 0 auto;
}

.meal-card__menu-line {
  flex: 1;
  min-width: 24rpx;
  height: 0;
  border-bottom: 1rpx dashed color-mix(in srgb, var(--color-text-tertiary) 65%, transparent);
}

.meal-card__menu-count {
  color: var(--color-text-secondary);
}

.meal-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx;
}

.floating-fab {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.floating-fab__backdrop {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.floating-fab__cluster {
  position: absolute;
  right: 32rpx;
  bottom: calc(52rpx + env(safe-area-inset-bottom));
  width: 500rpx;
  height: 420rpx;
  pointer-events: none;
}

.floating-fab__item,
.floating-fab__trigger {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.floating-fab__item {
  width: 176rpx;
  min-height: 76rpx;
  padding: 18rpx 26rpx;
  border-radius: 999rpx;
  box-shadow: var(--shadow-card);
  -webkit-backdrop-filter: saturate(125%) blur(12rpx);
  backdrop-filter: saturate(125%) blur(12rpx);
  transform-origin: right bottom;
  opacity: 0;
  transform: translate(0, 0) scale(0.42);
  pointer-events: none;
}

.floating-fab__item--expanded {
  opacity: 1;
  transform: translate(var(--fab-x), var(--fab-y)) scale(1);
  animation: floating-fab-pop 340ms cubic-bezier(0.18, 0.88, 0.24, 1.18) both;
  animation-delay: var(--fab-delay);
  pointer-events: auto;
}

.floating-fab__item--primary {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.floating-fab__item--surface {
  background: color-mix(in srgb, var(--color-surface-mask-medium) 80%, var(--color-surface) 20%);
  color: var(--color-text);
}

.floating-fab__item--warning {
  background: color-mix(in srgb, var(--color-surface) 70%, var(--color-warning-soft) 30%);
  color: var(--color-warning-text);
}

.floating-fab__item-label {
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.floating-fab__trigger {
  width: 90rpx;
  height: 90rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-fab__trigger--expanded {
  transform: scale(0.96);
}

.floating-fab__trigger-icon {
  line-height: 1;
  font-size: 34rpx;
  color: currentColor;
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.floating-fab__trigger--expanded .floating-fab__trigger-icon {
  transform: rotate(45deg);
}

@keyframes floating-fab-pop {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.42);
  }

  72% {
    opacity: 1;
    transform: translate(var(--fab-x), var(--fab-y)) scale(1.06);
  }

  100% {
    opacity: 1;
    transform: translate(var(--fab-x), var(--fab-y)) scale(1);
  }
}

.sheet-count {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
}

.editor-sheet__summary {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 8rpx 0 14rpx;
}

.editor-sheet__summary-date {
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: var(--font-weight-semibold);
}

.editor-sheet__summary-slot {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(244, 108, 83, 0.08);
  color: var(--color-primary);
  font-size: 22rpx;
}

.editor-sheet__section {
  margin-bottom: 18rpx;
}

.editor-sheet__section-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.editor-sheet__slot-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.editor-sheet__slot {
  padding: 16rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(215, 198, 173, 0.24);
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.editor-sheet__slot--active {
  background: rgba(244, 108, 83, 0.12);
  color: var(--color-primary);
}

.editor-sheet__list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recipe-option {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx;
  border: 2rpx solid rgba(215, 198, 173, 0.6);
  border-radius: 24rpx;
  background: rgba(255, 252, 246, 0.82);
}

.recipe-option--hover {
  transform: translateY(-2rpx);
}

.recipe-option--selected {
  border-color: rgba(244, 108, 83, 0.55);
  background: rgba(244, 108, 83, 0.06);
  box-shadow: 0 14rpx 34rpx rgba(244, 108, 83, 0.08);
}

.recipe-option__cover {
  flex: 0 0 auto;
  width: 120rpx;
  height: 120rpx;
  border-radius: 20rpx;
  background: #f0e7db;
}

.recipe-option__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-option__cover-text {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.recipe-option__main {
  flex: 1;
  min-width: 0;
}

.recipe-option__name {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
}

.recipe-option__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-option__check {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 40rpx;
  height: 40rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(244, 108, 83, 0.35);
  background: rgba(255, 255, 255, 0.92);
}

.recipe-option__check-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
  background: transparent;
}

.recipe-option__check-dot--selected {
  background: var(--color-primary);
}

.editor-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8rpx 0 24rpx;
  padding: 28rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));
  border-radius: 24rpx;
  background: linear-gradient(135deg, var(--color-primary) 0%, #f98565 100%);
  color: var(--color-primary-foreground);
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
}

.editor-submit--disabled {
  opacity: 0.52;
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
  background: rgba(255, 252, 246, 0.92);
  border: 2rpx solid rgba(215, 198, 173, 0.42);
  box-shadow: 0 14rpx 32rpx rgba(95, 79, 63, 0.08);
}

.plan-sort-card--placeholder {
  opacity: 0.18;
}

.plan-sort-card--ghost {
  box-shadow: 0 22rpx 56rpx rgba(95, 79, 63, 0.18);
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
  background: rgba(244, 108, 83, 0.08);
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
  background: rgba(244, 108, 83, 0.08);
  color: var(--color-primary);
}

.plan-sort__button--primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, #f98565 100%);
  color: var(--color-primary-foreground);
}

.plan-sort__ghost {
  position: fixed;
  z-index: 1300;
}
</style>
