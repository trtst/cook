<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="" full-screen>
    <template #navbar-center>
      <view class="nav-tabs">
          <view
            v-for="item in roleTabs"
            :key="item.value"
            class="nav-tabs__item font-medium"
            :class="{ 'nav-tabs__item--active': roleFilter === item.value }"
            @click="changeRoleFilter(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
    </template>

    <view v-if="legacyRedirecting" class="event-redirect">
      <text class="event-redirect__title">正在打开餐次详情…</text>
      <text class="event-redirect__desc">旧饭局入口已经并入统一餐次详情页。</text>
    </view>

    <view v-else class="event-page">
      <view class="ingredient-page-head">
        <view class="sticky-wrap">
          <view class="sticky-bar">
            <scroll-view scroll-x class="filter-scroll" show-scrollbar="false">
              <view class="filter-row">
                <view
                  v-for="item in stageTabs"
                  :key="item.value"
                  class="filter-chip"
                  :class="{ 'filter-chip--active': stage === item.value }"
                  @click="changeStage(item.value)"
                >
                  <text class="filter-chip__label">{{ item.label }}</text>
                  <text class="filter-chip__count">{{ stageCount(item.value) }}</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
      </view>

      <view class="list-scroll-wrap">
        <RecipeSearchLoading
          :pull-distance="pullDistance"
          :refreshing="refreshing"
          :show-success="showSuccess"
          :refresher-text="refresherText"
          :threshold="refresherThreshold"
        />

        <scroll-view
          scroll-y
          class="list-scroll"
          refresher-enabled
          refresher-default-style="none"
          :show-scrollbar="false"
          :refresher-threshold="refresherThreshold"
          :refresher-triggered="refresherTriggered"
          @scrolltolower="handleLoadMore"
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <LoginEmptyState
            v-if="!sessionStore.isLoggedIn"
            class="page-empty"
            :art="emptyStateArt"
            title="登录后查看你的饭局"
            description="上面的分组会先保留；登录后再看你发起的、你参加的和已经结束的饭局。"
            @success="handleLoginSuccess"
          />

          <template v-else>
          <view v-if="loading && !eventCards.length" class="notice">正在同步饭局...</view>

          <view v-if="visibleCards.length" class="event-list">
            <view
              v-for="item in visibleCards"
              :key="item.id"
              class="event-card"
              hover-class="event-card--hover"
              hover-stay-time="100"
              @click="openEvent(item)"
            >
              <view class="event-card__top">
                <image v-if="item.coverImageUrl" class="event-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                <view v-else class="event-card__cover event-card__cover--empty">
                  <text class="event-card__cover-empty">{{ item.coverText }}</text>
                </view>
                <text v-if="item.focusText" class="event-card__focus">{{ item.focusText }}</text>
              </view>

              <view class="event-card__body">
                <view class="event-card__main">
                  <text class="event-card__title">{{ item.title }}</text>
                </view>

                <view class="event-card__rows">
                  <view class="event-card__row">
                    <text class="cookfont icon-time event-card__row-icon" />
                    <text class="event-card__row-text">{{ item.scheduleText }}</text>
                  </view>
                  <view class="event-card__row">
                    <text class="cookfont icon-notice event-card__row-icon" />
                    <text class="event-card__row-text">{{ item.statLine }}</text>
                  </view>
                </view>

                <scroll-view v-if="item.menuPreview.length" scroll-x class="event-card__menu" show-scrollbar="false">
                  <view class="event-card__menu-track">
                    <text v-for="title in item.menuPreview" :key="`${item.id}-${title}`" class="event-card__menu-chip">{{ title }}</text>
                    <text v-if="item.moreMenuCount" class="event-card__menu-chip event-card__menu-chip--more">+{{ item.moreMenuCount }}</text>
                  </view>
                </scroll-view>

                <view class="event-card__footer">
                  <text class="event-card__organizer">{{ item.organizerText }}</text>
                  <text class="event-card__action">{{ item.actionText }}</text>
                </view>
              </view>
            </view>
          </view>

          <LoadMore
            v-if="visibleCards.length"
            :loading="loadingMore"
            :has-next="hasNext"
            :show-done="hasLoadedMoreOnce && !hasNext"
          />

          <Empty
            v-else-if="!loading"
            class="page-empty"
            :art="emptyStateArt"
            title="还没有饭局安排"
            :description="emptyDescription"
          />
          </template>
        </scroll-view>
      </view>

      <view class="event-fab" hover-class="event-fab--hover" hover-stay-time="100" @click="openCreateSheet">
        <text class="cookfont icon-add event-fab__icon" />
      </view>
    </view>

    <EventScheduleSheet
      :visible="createSheetVisible"
      title="直接发起饭局"
      subtitle="先把日期、餐次和时间定下来，菜单后面再补。"
      date-mode="calendar"
      :date="createPlanDate"
      :month-date="createMonthDate"
      :min-date="createMinDate"
      :time="createTime"
      :meal-slot="createMealSlot"
      :meal-slots="createSlotOptions"
      :submitting="creatingEvent"
      cancel-text="取消"
      confirm-text="确认发起"
      confirm-loading-text="创建中..."
      @select-date="handleCreateDateSelect"
      @month-change="handleCreateMonthChange"
      @select-time="handleCreateTimeSelect"
      @select-meal-slot="selectCreateMealSlot"
      @confirm="submitCreateEvent"
      @close="closeCreateSheet"
      @after-close="handleCreateSheetAfterClose"
    />
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ApiClientError, type UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import LoadMore from "@/components/LoadMore.vue";
import LoginEmptyState from "@/components/Login/LoginEmptyState.vue";
import EventScheduleSheet from "@/components/Meal/EventScheduleSheet.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot, isMealSlotExpired, isPastLocalDateTime, resolveMealSlotByTime, resolveMealSlotSuggestedTime } from "@/utils/meal-slot";
import emptyStateArt from "@/assets/recipe-page/empty-state.svg";
import { formatDateTimeMinute } from "../utils/date";
import { mealApi, type DiningEventListStage, type DiningEventListSummary, type MealPlanSummary, type DiningEventStageCounts, type DiningEventListRole } from "../apis/meal";

type EventStage = DiningEventListStage;
type RoleFilter = DiningEventListRole;
type MealSlot = MealPlanSummary["mealSlot"];

type EventCardItem = {
  id: string;
  eventId: UUID;
  planItemId: UUID | null;
  planDate: string;
  stage: EventStage;
  role: Exclude<RoleFilter, "ALL">;
  title: string;
  coverImageUrl: string | null;
  coverText: string;
  scheduleText: string;
  focusText: string;
  actionText: string;
  organizerText: string;
  menuPreview: string[];
  moreMenuCount: number;
  statLine: string;
  sortTime: number;
};

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const EVENT_PAGE_SIZE = 20;
const EMPTY_STAGE_COUNTS: DiningEventStageCounts = {
  todoCount: 0,
  activeCount: 0,
  doneCount: 0
};

const legacyRedirecting = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const hasNext = ref(false);
const hasLoadedMoreOnce = ref(false);
const currentPage = ref(1);
const stage = ref<EventStage>("TODO");
const roleFilter = ref<RoleFilter>("ALL");
const stageCounts = ref<DiningEventStageCounts>(EMPTY_STAGE_COUNTS);
const eventCards = ref<EventCardItem[]>([]);
const createSheetVisible = ref(false);
const creatingEvent = ref(false);
const createPlanDate = ref(todayText());
const createMonthDate = ref(todayText());
const createMealSlot = ref<MealPlanSummary["mealSlot"]>("DINNER");
const createTime = ref(resolveDefaultTime("DINNER"));
const createMinDate = computed(() => todayText());

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
    pulling: "下拉刷新饭局",
    canRelease: ["松手刷新饭局", "更新当前进展"],
    success: "饭局已刷新"
  }
});

const roleTabs = [
  { value: "ALL" as const, label: "全部" },
  { value: "ORGANIZER" as const, label: "发起的" },
  { value: "PARTICIPANT" as const, label: "参与的" }
];

const stageTabs = [
  { value: "TODO" as const, label: "待我处理" },
  { value: "ACTIVE" as const, label: "进行中" },
  { value: "DONE" as const, label: "已结束" }
];

const createSlotBaseOptions = [
  { value: "BREAKFAST" as const, label: "早餐" },
  { value: "LUNCH" as const, label: "午餐" },
  { value: "AFTERNOON_TEA" as const, label: "下午茶" },
  { value: "DINNER" as const, label: "晚餐" },
  { value: "LATE_NIGHT" as const, label: "夜宵" }
];
const createSlotOptions = computed(() =>
  createSlotBaseOptions.map(item => ({
    ...item,
    disabled: isMealSlotExpired(createPlanDate.value, item.value, new Date())
  }))
);

const visibleCards = computed(() => eventCards.value);

const emptyDescription = computed(
  () => "先把时间约起来，菜单后面再补也没关系。你发起的和参与的饭局，后面都会收在这里。"
);

onLoad(query => {
  const planItemId = parseQueryText(query?.planItemId);
  const planDate = parseQueryText(query?.planDate);
  const eventId = parseQueryText(query?.eventId);
  const mode = parseQueryText(query?.mode);

  if (planItemId || planDate || eventId || mode) {
    legacyRedirecting.value = true;
    const params = [
      planItemId ? `planItemId=${encodeURIComponent(planItemId)}` : "",
      planDate ? `planDate=${encodeURIComponent(planDate)}` : "",
      eventId ? `eventId=${encodeURIComponent(eventId)}` : "",
      mode ? `mode=${encodeURIComponent(mode)}` : ""
    ].filter(Boolean);
    const target = `/pages_meal/detail/index${params.length ? `?${params.join("&")}` : ""}`;
    void uniPlatform.navigation.redirectTo(target).catch(() => {
      void uniPlatform.navigation.navigateTo(target);
    });
  }
});

onShow(() => {
  if (!sessionStore.isLoggedIn || legacyRedirecting.value) return;
  void loadEvents({ reset: true, syncStage: true });
});

async function handleLoginSuccess() {
  await loadEvents({ reset: true, syncStage: true });
}

function stageCount(target: EventStage) {
  if (target === "TODO") return stageCounts.value.todoCount;
  if (target === "ACTIVE") return stageCounts.value.activeCount;
  return stageCounts.value.doneCount;
}

async function loadEvents(options: { reset: boolean; syncStage?: boolean }) {
  if (!sessionStore.isLoggedIn) return;
  if (options.reset) {
    if (loading.value) return;
    loading.value = true;
    hasLoadedMoreOnce.value = false;
  } else {
    if (loadingMore.value || !hasNext.value) return;
    loadingMore.value = true;
  }

  const nextPage = options.reset ? 1 : currentPage.value + 1;

  try {
    const result = await mealApi.listDiningEvents({
      page: nextPage,
      pageSize: EVENT_PAGE_SIZE,
      role: roleFilter.value,
      stage: stage.value
    });
    stageCounts.value = result.stageCounts;

    if (options.syncStage) {
      const fallbackStage = resolveFallbackStage(stageCounts.value, stage.value);
      if (fallbackStage && fallbackStage !== stage.value) {
        stage.value = fallbackStage;
        if (options.reset) {
          loading.value = false;
        } else {
          loadingMore.value = false;
        }
        await loadEvents({ reset: true, syncStage: false });
        return;
      }
    }

    currentPage.value = result.page;
    hasNext.value = result.hasNext;
    const nextItems = result.items.map(item => buildEventCard(item));
    if (!options.reset && nextItems.length > 0) {
      hasLoadedMoreOnce.value = true;
    }
    eventCards.value = options.reset ? nextItems : [...eventCards.value, ...nextItems];
  } catch (error) {
    await uniPlatform.feedback.toast({ title: "饭局同步失败，请稍后重试", icon: "none" });
  } finally {
    if (options.reset) {
      loading.value = false;
    } else {
      loadingMore.value = false;
    }
  }
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadEvents({ reset: true, syncStage: false });
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

function buildEventCard(item: DiningEventListSummary): EventCardItem {
  const scheduleTime = Date.parse(item.scheduledAt);
  const eventExpired = isEventExpired(item.status, item.scheduledAt);
  return {
    id: `${item.planItemId ?? item.id}-${item.id}`,
    eventId: item.id,
    planItemId: item.planItemId,
    planDate: item.planDate || "",
    stage: item.stage,
    role: item.role,
    title: item.title,
    coverImageUrl: item.coverImageUrl,
    coverText: `${formatMealSlot(item.mealSlot) || "这顿饭"}封面待补`,
    scheduleText: buildScheduleText(item.scheduledAt),
    focusText: resolveFocusText(item.role, item.participantStatus, item.status, eventExpired),
    actionText: item.status === "COMPLETED" || eventExpired ? "回看这顿饭" : "查看详情",
    organizerText: item.organizerName?.trim()
      ? `发起人 · ${item.organizerName.trim()}`
      : item.role === "ORGANIZER"
        ? "发起人 · 我"
        : "发起人 · 待补",
    menuPreview: item.menuPreview,
    moreMenuCount: Math.max(item.menuCount - item.menuPreview.length, 0),
    statLine: buildStatLine(item.acceptedCount, item.participantCount, item.menuCount, item.bringCount),
    sortTime: Number.isNaN(scheduleTime) ? Date.now() : scheduleTime
  };
}

function buildStatLine(acceptedCount: number, participantCount: number, menuCount: number, bringCount: number) {
  const segments = [`${acceptedCount}/${participantCount || 0} 已回应`, `${menuCount}道菜`];
  if (bringCount) segments.push(`${bringCount}人带菜`);
  return segments.join(" · ");
}

function resolveFocusText(
  role: EventCardItem["role"],
  myStatus: DiningEventListSummary["participantStatus"],
  status: DiningEventListSummary["status"],
  eventExpired: boolean
) {
  if (eventExpired) return "这场局已结束";
  if (status === "COMPLETED") return "可看饭局回忆";
  if (status === "CANCELLED") return "这场局已取消";
  if (role === "PARTICIPANT" && myStatus === "INVITED") return "等你回应";
  if (role === "PARTICIPANT" && myStatus === "DECLINED") return "你已拒绝";
  if (role === "PARTICIPANT" && myStatus === "REMOVED") return "已被移出";
  if (role === "ORGANIZER" && status === "PLANNED") return "待你继续推进";
  if (role === "ORGANIZER" && status === "CONFIRMED") return "待你收尾";
  return "";
}

function buildScheduleText(value: string) {
  const fullText = formatDateTimeMinute(value, "");
  if (!fullText) return "时间待定";
  const [dateText, timeText] = fullText.split(" ");
  if (!dateText || !timeText) return fullText;
  return `${dateText.slice(5)} ${timeText}`;
}

function isEventExpired(status: DiningEventListSummary["status"], scheduledAtText: string) {
  if (status === "CANCELLED" || status === "COMPLETED") return false;
  const scheduledAt = Date.parse(scheduledAtText);
  return Number.isFinite(scheduledAt) && scheduledAt <= Date.now();
}

function resolveFallbackStage(counts: DiningEventStageCounts, currentStage: EventStage) {
  if (currentStage === "TODO" && counts.todoCount > 0) return currentStage;
  if (currentStage === "ACTIVE" && counts.activeCount > 0) return currentStage;
  if (currentStage === "DONE" && counts.doneCount > 0) return currentStage;
  return stageTabs.find(item => stageCount(item.value) > 0)?.value ?? null;
}

async function handleLoadMore() {
  await loadEvents({ reset: false });
}

function changeStage(nextStage: EventStage) {
  if (stage.value === nextStage) return;
  stage.value = nextStage;
  void loadEvents({ reset: true, syncStage: false });
}

function changeRoleFilter(nextFilter: RoleFilter) {
  if (roleFilter.value === nextFilter) return;
  roleFilter.value = nextFilter;
  void loadEvents({ reset: true, syncStage: true });
}

function openEvent(item: EventCardItem) {
  const params = [
    item.planItemId ? `planItemId=${encodeURIComponent(String(item.planItemId))}` : "",
    item.planDate ? `planDate=${encodeURIComponent(item.planDate)}` : "",
    `eventId=${encodeURIComponent(String(item.eventId))}`
  ].filter(Boolean);
  void uniPlatform.navigation.navigateTo(`/pages_meal/detail/index?${params.join("&")}`);
}

function openCreateSheet() {
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openCreateSheet();
    });
    return;
  }
  const initialDate = resolveCreateStartDate();
  const initialSlot = resolveFirstAvailableCreateSlot(initialDate) ?? "BREAKFAST";
  createPlanDate.value = initialDate;
  createMonthDate.value = createPlanDate.value;
  createMealSlot.value = initialSlot;
  createTime.value = resolveDefaultTime(initialSlot, createPlanDate.value);
  createSheetVisible.value = true;
}

function closeCreateSheet() {
  if (creatingEvent.value) return;
  createSheetVisible.value = false;
}

function handleCreateSheetAfterClose() {
  if (createSheetVisible.value) return;
}

function handleCreateDateSelect(nextValue: string) {
  const nextSlot = resolveFirstAvailableCreateSlot(nextValue);
  if (!nextSlot) {
    const fallbackDate = nextDateText(nextValue);
    const fallbackSlot = resolveFirstAvailableCreateSlot(fallbackDate) ?? "BREAKFAST";
    createPlanDate.value = fallbackDate;
    createMonthDate.value = fallbackDate;
    createMealSlot.value = fallbackSlot;
    createTime.value = resolveDefaultTime(fallbackSlot, fallbackDate);
    return;
  }

  createPlanDate.value = nextValue;
  createMonthDate.value = nextValue;
  if (isMealSlotExpired(nextValue, createMealSlot.value, new Date())) {
    createMealSlot.value = nextSlot;
  }
  if (isPastLocalDateTime(nextValue, createTime.value)) {
    createTime.value = resolveDefaultTime(createMealSlot.value, nextValue);
  }
}

function handleCreateMonthChange(nextValue: string) {
  createMonthDate.value = nextValue;
}

function handleCreateTimeSelect(nextValue: string) {
  createTime.value = nextValue;
  const nextSlot = resolveMealSlotByTime(nextValue);
  if (!nextSlot) return;
  createMealSlot.value = nextSlot;
}

function selectCreateMealSlot(nextSlot: MealPlanSummary["mealSlot"]) {
  const target = createSlotOptions.value.find(item => item.value === nextSlot);
  if (target?.disabled) return;
  if (createMealSlot.value === nextSlot) return;
  createMealSlot.value = nextSlot;
  createTime.value = resolveDefaultTime(nextSlot, createPlanDate.value);
}

async function submitCreateEvent() {
  if (creatingEvent.value) return;
  creatingEvent.value = true;

  try {
    if (isPastLocalDateTime(createPlanDate.value, createTime.value)) {
      throw new Error("饭局时间不能早于当前时间");
    }
    const result = await mealApi.createDirectDiningEvent({
      operationId: createOperationId(),
      planDate: createPlanDate.value,
      mealSlot: createMealSlot.value,
      scheduledAt: composeScheduledAt(createPlanDate.value, createTime.value),
      location: null
    });
    createSheetVisible.value = false;
    void uniPlatform.navigation.navigateTo(buildEventDetailPath(result.id, createPlanDate.value, result.planItemId));
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 409 && error.message.includes("已发起饭局")) {
      const existingEvent = await mealApi.findDiningEventByPlanSlot(createPlanDate.value, createMealSlot.value);
      if (existingEvent) {
        createSheetVisible.value = false;
        await uniPlatform.feedback.toast({ title: "这顿饭已挂饭局，直接带你回到详情", icon: "none" });
        void uniPlatform.navigation.navigateTo(
          buildEventDetailPath(existingEvent.id, createPlanDate.value, existingEvent.planItemId ?? undefined)
        );
        return;
      }
    }
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "发起失败", icon: "none" });
  } finally {
    creatingEvent.value = false;
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack();
}

function openLogin(action: (() => void) | null = null) {
  useLoginModalStore().open(null, action);
}

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}

function resolveDefaultTime(slot: MealPlanSummary["mealSlot"], dateText = todayText()) {
  return resolveMealSlotSuggestedTime(slot, dateText);
}

function resolveFirstAvailableCreateSlot(dateText: string) {
  const now = new Date();
  return createSlotBaseOptions.find(item => !isMealSlotExpired(dateText, item.value, now))?.value ?? null;
}

function resolveCreateStartDate() {
  const today = todayText();
  if (resolveFirstAvailableCreateSlot(today)) return today;
  return nextDateText(today);
}

function nextDateText(dateText: string) {
  const current = new Date(`${dateText}T12:00:00`);
  if (Number.isNaN(current.getTime())) return todayText();
  current.setDate(current.getDate() + 1);
  const year = current.getFullYear();
  const month = `${current.getMonth() + 1}`.padStart(2, "0");
  const day = `${current.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function composeScheduledAt(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

function buildEventDetailPath(eventId: UUID, planDate: string, planItemId?: UUID | null) {
  const params = [
    planItemId ? `planItemId=${encodeURIComponent(String(planItemId))}` : "",
    planDate ? `planDate=${encodeURIComponent(planDate)}` : "",
    `eventId=${encodeURIComponent(String(eventId))}`
  ].filter(Boolean);
  return `/pages_meal/detail/index?${params.join("&")}`;
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function automatorOpenCreateSheet() {
  openCreateSheet();
  await nextTick();
  const loginModalStore = useLoginModalStore();
  return {
    loggedIn: sessionStore.isLoggedIn,
    createSheetVisible: createSheetVisible.value,
    loginVisible: loginModalStore.visible,
    loginMode: loginModalStore.mode
  };
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
}

async function automatorClearSession() {
  await sessionStore.clearSession();
}

async function automatorSelectCreateMealSlot(nextSlot: MealSlot) {
  if (!createSheetVisible.value) {
    openCreateSheet();
  }
  await nextTick();
  selectCreateMealSlot(nextSlot);
  await nextTick();
  return {
    createMealSlot: createMealSlot.value,
    createTime: createTime.value
  };
}

async function automatorSelectCreateDate(nextValue: string) {
  if (!createSheetVisible.value) {
    openCreateSheet();
  }
  await nextTick();
  handleCreateDateSelect(nextValue);
  await nextTick();
  return {
    createPlanDate: createPlanDate.value,
    createMealSlot: createMealSlot.value,
    createTime: createTime.value
  };
}

async function automatorSelectCreateTime(nextValue: string) {
  if (!createSheetVisible.value) {
    openCreateSheet();
  }
  await nextTick();
  handleCreateTimeSelect(nextValue);
  await nextTick();
  return {
    createMealSlot: createMealSlot.value,
    createTime: createTime.value
  };
}

defineExpose({
  automatorApplySession,
  automatorClearSession,
  automatorOpenCreateSheet,
  automatorSelectCreateDate,
  automatorSelectCreateMealSlot,
  automatorSelectCreateTime
});
</script>

<style scoped lang="scss">
.event-page,
.list-scroll-wrap,
.list-scroll {
  height: 100%;
  min-height: 0;
}

.event-page {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.header-tabs {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.header-tabs__back {
  display: flex;
  align-items: center;
  width: 64rpx;
  height: 64rpx;
  color: var(--color-text);
  font-size: 34rpx;
  line-height: 1;
}

.header-tabs__back--hover {
  opacity: 0.82;
}

.nav-tabs {
  display: flex;
  gap: 52rpx;
  align-items: flex-start;
  width: 100%;
}

.nav-tabs__item {
  position: relative;
  z-index: 0;
  flex: 0 0 auto;
  padding: 8rpx 0 12rpx;
  color: var(--color-text-secondary);
  font-size: 40rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  white-space: nowrap;
}

.nav-tabs__item--active {
  color: var(--color-text);
}

.nav-tabs__item--active::after {
  content: "";
  position: absolute;
  right: -8rpx;
  bottom: 2rpx;
  left: -8rpx;
  z-index: -1;
  height: 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-support-action);
  opacity: 0.3;
  transform: rotate(-5deg);
}

.ingredient-page-head {
  position: relative;
  z-index: 25;
  flex: none;
  box-sizing: border-box;
  padding: 10rpx var(--space-page) 0;
  background: var(--color-page);
}

.sticky-wrap {
  position: relative;
  z-index: 2;
  flex: none;
  margin-top: 20rpx;
  padding-bottom: 16rpx;
  background: var(--color-page);
}

.sticky-bar {
  display: flex;
  align-items: center;
  min-height: 56rpx;
}

.filter-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}

.filter-row {
  display: flex;
  gap: 16rpx;
  width: max-content;
  padding-right: 24rpx;
}

.filter-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  flex: 0 0 auto;
  gap: 10rpx;
  height: 56rpx;
  padding: 0 28rpx;
  border: 1rpx solid var(--color-divider);
  border-radius: var(--radius-xs);
  background: var(--color-surface-muted);
  white-space: nowrap;
}

.filter-chip--active {
  border-color: transparent;
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
}

.filter-chip__label,
.filter-chip__count {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;
}

.filter-chip--active .filter-chip__label,
.filter-chip--active .filter-chip__count {
  color: var(--color-tag-primary-text);
}

.list-scroll-wrap {
  display: flex;
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0 var(--space-page);
}

.list-scroll {
  flex: 1;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.notice {
  margin-top: 20rpx;
  padding: 24rpx 26rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted-frost);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notice--soft {
  background: var(--color-state-warning-soft);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-page);
  padding-top: 20rpx;
  padding-bottom: env(safe-area-inset-bottom);
}

.event-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.event-card--hover {
  transform: translateY(-2rpx);
  box-shadow: var(--material-card-shadow);
}

.event-card__top {
  position: relative;
  overflow: hidden;
  height: 260rpx;
  background: var(--page-cover-fresh-bg);
}

.event-card__body {
  padding: 24rpx;
}

.event-card__focus {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  z-index: 2;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: var(--color-surface-overlay-soft);
  color: var(--color-state-warning-text);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.event-card__main {
  margin-top: 0;
}

.event-card__title {
  display: block;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.28;
}

.event-card__cover {
  width: 100%;
  height: 100%;
}

.event-card__cover--empty {
  display: flex;
  align-items: flex-end;
  padding: 22rpx;
  box-sizing: border-box;
}

.event-card__cover-empty {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.4;
}

.event-card__rows {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.event-card__row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.event-card__row-icon {
  margin-top: 2rpx;
  color: var(--color-icon-secondary);
  font-size: 22rpx;
  text-align: center;
}

.event-card__row-text {
  flex: 1;
  color: var(--color-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.event-card__menu {
  margin-top: 18rpx;
  white-space: nowrap;
}

.event-card__menu-track {
  display: inline-flex;
  gap: 12rpx;
  padding-right: 24rpx;
}

.event-card__menu-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: var(--color-support-notice);
  color: var(--color-text);
  font-size: 22rpx;
}

.event-card__menu-chip--more {
  background: var(--color-surface-muted-frost);
  color: var(--color-text-secondary);
}

.event-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid var(--color-border-light);
}

.event-card__organizer {
  flex: 1;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.event-card__action {
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}

.page-empty {
  margin-top: 20rpx;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.event-fab {
  position: fixed;
  right: 24rpx;
  bottom: calc(34rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
}

.event-fab--hover {
  opacity: 0.94;
}

.event-fab__icon {
  color: var(--button-primary-text);
  font-size: 30rpx;
}

.event-redirect {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  text-align: center;
}

.event-redirect__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 700;
}

.event-redirect__desc {
  margin-top: 16rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}
</style>
