<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" :show-left="false" navbar-layout="custom-left" full-screen>
    <template #navbar-left>
      <view class="header-tabs">
        <view class="cookfont icon-back header-tabs__back" hover-class="header-tabs__back--hover" hover-stay-time="100" @click="goBack" />
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
      </view>
    </template>

    <view v-if="legacyRedirecting" class="event-redirect">
      <text class="event-redirect__title">正在打开餐次详情…</text>
      <text class="event-redirect__desc">旧饭局入口已经并入统一餐次详情页。</text>
    </view>

    <Login
      v-else-if="!sessionStore.isLoggedIn"
      title="登录后查看饭局"
      description="你发起的、你参加的、已经结束的饭局，都会收在这里。"
      @success="handleLoginSuccess"
    />

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
          @refresherpulling="onRefresherPulling"
          @refresherrefresh="handleRefresherRefresh"
          @refresherrestore="onRefresherRestore"
          @refresherabort="onRefresherRestore"
        >
          <view v-if="errorText" class="notice notice--error" @click="loadEvents">
            {{ errorText }}
          </view>
          <view v-else-if="loading && !eventCards.length" class="notice">正在同步饭局...</view>
          <view v-else-if="partialErrorText" class="notice notice--soft">
            {{ partialErrorText }}
          </view>

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
                <view class="event-card__badges">
                  <text class="event-card__badge event-card__badge--role">{{ item.roleText }}</text>
                  <text class="event-card__badge" :class="item.statusClass">{{ item.statusText }}</text>
                </view>
                <text v-if="item.focusText" class="event-card__focus">{{ item.focusText }}</text>
              </view>

              <view class="event-card__main">
                <view class="event-card__main-shell" :class="{ 'event-card__main-shell--with-cover': Boolean(item.coverImageUrl) }">
                  <view class="event-card__main-text">
                    <text class="event-card__title">{{ item.title }}</text>
                    <text class="event-card__desc">{{ item.description }}</text>
                  </view>
                  <image v-if="item.coverImageUrl" class="event-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                </view>
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

              <view v-if="item.menuPreview.length" class="event-card__menu">
                <text v-for="title in item.menuPreview" :key="`${item.id}-${title}`" class="event-card__menu-chip">{{ title }}</text>
                <text v-if="item.moreMenuCount" class="event-card__menu-chip event-card__menu-chip--more">+{{ item.moreMenuCount }}</text>
              </view>

              <view class="event-card__footer">
                <text class="event-card__organizer">{{ item.organizerText }}</text>
                <text class="event-card__action">{{ item.actionText }}</text>
              </view>
            </view>
          </view>

          <Empty
            v-else-if="!loading"
            class="page-empty"
            title="这一栏还没有饭局"
            :description="emptyDescription"
          />
        </scroll-view>
      </view>

      <view class="event-fab" hover-class="event-fab--hover" hover-stay-time="100" @click="openCreateSheet">
        <text class="cookfont icon-add event-fab__icon" />
      </view>
    </view>

    <SheetShell
      :visible="createSheetVisible"
      title="直接发起饭局"
      subtitle="先把日期、餐次和时间定下来，菜单后面再补。"
      @close="closeCreateSheet"
      @after-close="handleCreateSheetAfterClose"
    >
      <view class="sheet-field">
        <text class="sheet-field__label">日期</text>
        <picker mode="date" :value="createPlanDate" @change="handleCreateDateChange">
          <view class="sheet-picker">{{ createPlanDate }}</view>
        </picker>
      </view>

      <view class="sheet-field">
        <text class="sheet-field__label">餐次</text>
        <view class="sheet-chip-grid">
          <view
            v-for="item in createSlotOptions"
            :key="item.value"
            class="sheet-chip"
            :class="{ 'sheet-chip--active': createMealSlot === item.value }"
            @click="selectCreateMealSlot(item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>

      <view class="sheet-field">
        <text class="sheet-field__label">时间</text>
        <picker mode="time" :value="createTime" @change="handleCreateTimeChange">
          <view class="sheet-picker">{{ createTime }}</view>
        </picker>
      </view>

      <template #footer>
        <view class="sheet-actions">
          <button class="sheet-actions__button sheet-actions__button--cancel" :disabled="creatingEvent" @click="closeCreateSheet">
            取消
          </button>
          <button class="sheet-actions__button sheet-actions__button--confirm" :disabled="creatingEvent" @click="submitCreateEvent">
            {{ creatingEvent ? "创建中..." : "确认发起" }}
          </button>
        </view>
      </template>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import type { UUID } from "@/apis/http";
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
import { formatMealSlot, mealSlotDefaultTime } from "@/utils/meal-slot";
import { formatDateTimeMinute } from "../utils/date";
import { mealApi, type DiningEventSummary, type MealPlanSummary } from "../apis/meal";

type EventStage = "TODO" | "ACTIVE" | "DONE";
type RoleFilter = "ALL" | "ORGANIZER" | "PARTICIPANT";

type EventCardItem = {
  id: string;
  eventId: UUID;
  planItemId: UUID | null;
  planDate: string;
  stage: EventStage;
  role: Exclude<RoleFilter, "ALL">;
  roleText: string;
  title: string;
  description: string;
  coverImageUrl: string | null;
  scheduleText: string;
  statusText: string;
  statusClass: string;
  focusText: string;
  actionText: string;
  organizerText: string;
  menuPreview: string[];
  moreMenuCount: number;
  statLine: string;
  sortTime: number;
};

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();

const legacyRedirecting = ref(false);
const loading = ref(false);
const errorText = ref("");
const partialErrorText = ref("");
const stage = ref<EventStage>("TODO");
const roleFilter = ref<RoleFilter>("ALL");
const eventCards = ref<EventCardItem[]>([]);
const createSheetVisible = ref(false);
const creatingEvent = ref(false);
const createPlanDate = ref(todayText());
const createMealSlot = ref<MealPlanSummary["mealSlot"]>("DINNER");
const createTime = ref(resolveDefaultTime("DINNER"));

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

const createSlotOptions = [
  { value: "BREAKFAST" as const, label: "早餐" },
  { value: "LUNCH" as const, label: "午餐" },
  { value: "AFTERNOON_TEA" as const, label: "下午茶" },
  { value: "DINNER" as const, label: "晚餐" },
  { value: "LATE_NIGHT" as const, label: "夜宵" }
];

const roleCards = computed(() =>
  eventCards.value.filter(item => roleFilter.value === "ALL" || item.role === roleFilter.value)
);

const visibleCards = computed(() =>
  roleCards.value
    .filter(item => item.stage === stage.value)
    .sort((left, right) => compareCards(left, right, stage.value))
);

const emptyDescription = computed(() => {
  if (stage.value === "TODO") {
    if (roleFilter.value === "PARTICIPANT") return "当前没有等你回应的饭局，别人邀请你之后会先出现在这里。";
    if (roleFilter.value === "ORGANIZER") return "你发起的饭局暂时没有待推进项，先去计划页发起一场新的也可以。";
    return "当前没有待你处理的饭局，先去计划页发起，或者等别人邀请你加入。";
  }
  if (stage.value === "ACTIVE") {
    if (roleFilter.value === "PARTICIPANT") return "你参与的饭局暂时没有正在进行中的记录。";
    if (roleFilter.value === "ORGANIZER") return "你发起的饭局暂时没有正在进行中的记录。";
    return "目前没有进行中的饭局，等新的一场局开始后再来看。";
  }
  if (roleFilter.value === "PARTICIPANT") return "你参加过的结束态饭局还没有出现在这里。";
  if (roleFilter.value === "ORGANIZER") return "你发起过的结束态饭局还没有出现在这里。";
  return "还没有结束态饭局，等第一场饭局收尾后，这里会留下记录。";
});

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
  void loadEvents();
});

async function handleLoginSuccess() {
  await loadEvents();
}

function stageCount(target: EventStage) {
  return roleCards.value.filter(item => item.stage === target).length;
}

async function loadEvents() {
  if (!sessionStore.isLoggedIn || loading.value) return;
  loading.value = true;
  errorText.value = "";
  partialErrorText.value = "";

  try {
    const plans = await mealApi.listAllPlans({});
    const seenEventIds = new Set<UUID>();
    const plansWithEvents = plans
      .filter(plan => plan.hasDiningEvent && Boolean(plan.diningEventId))
      .filter(plan => {
        const nextEventId = plan.diningEventId;
        if (!nextEventId || seenEventIds.has(nextEventId)) return false;
        seenEventIds.add(nextEventId);
        return true;
      });

    const detailResults = await Promise.allSettled(
      plansWithEvents.map(async plan => ({
        plan,
        event: await mealApi.getDiningEvent(plan.diningEventId as UUID)
      }))
    );

    const failedCount = detailResults.filter(item => item.status === "rejected").length;
    if (failedCount) {
      partialErrorText.value = `有 ${failedCount} 场饭局暂未同步完整，先展示已加载部分。`;
    }

    eventCards.value = detailResults
      .filter((item): item is PromiseFulfilledResult<{ plan: MealPlanSummary; event: DiningEventSummary }> => item.status === "fulfilled")
      .map(item => buildEventCard(item.value.plan, item.value.event));
    syncStageWithRole();
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "饭局加载失败";
  } finally {
    loading.value = false;
  }
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadEvents();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

function buildEventCard(plan: MealPlanSummary, event: DiningEventSummary): EventCardItem {
  const role: EventCardItem["role"] = event.organizerUid === sessionStore.uid ? "ORGANIZER" : "PARTICIPANT";
  const myParticipant = event.participants.find(item => item.userUid === sessionStore.uid) ?? null;
  const acceptedCount = event.participants.filter(item => item.status === "ACCEPTED").length;
  const bringCount = event.participants.filter(item => Boolean(item.bringRecipeTitle?.trim())).length;
  const participantCount = event.participants.length;
  const menuPreview = event.menuItems.slice(0, 3).map(item => item.title);
  const menuCount = event.menuItems.length;
  const scheduleTime = Date.parse(event.scheduledAt);
  const stageValue = resolveStage(event, role, myParticipant?.status ?? null);
  const title = buildCardTitle(plan, event);
  const description = event.title?.trim()
    ? event.title.trim()
    : menuPreview.length
      ? `这顿饭先定了 ${menuPreview.join("、")}${menuCount > menuPreview.length ? " 等菜" : ""}。`
      : "这顿饭先把时间和菜单定下来。";

  return {
    id: `${plan.id}-${event.id}`,
    eventId: event.id,
    planItemId: plan.id,
    planDate: plan.planDate,
    stage: stageValue,
    role,
    roleText: role === "ORGANIZER" ? "我发起的" : "我参与的",
    title,
    description,
    coverImageUrl: event.coverImageUrl,
    scheduleText: buildScheduleText(event.scheduledAt),
    statusText: formatEventStatus(event.status),
    statusClass: resolveStatusClass(event.status),
    focusText: resolveFocusText(event, role, myParticipant?.status ?? null),
    actionText: event.status === "COMPLETED" ? "回看这顿饭" : "查看详情",
    organizerText: event.organizerName?.trim()
      ? `发起人 · ${event.organizerName.trim()}`
      : role === "ORGANIZER"
        ? "发起人 · 我"
        : "发起人 · 待补",
    menuPreview,
    moreMenuCount: Math.max(menuCount - menuPreview.length, 0),
    statLine: buildStatLine(acceptedCount, participantCount, menuCount, bringCount),
    sortTime: Number.isNaN(scheduleTime) ? Date.now() : scheduleTime
  };
}

function buildCardTitle(plan: MealPlanSummary, event: DiningEventSummary) {
  const dateText = formatPlanDate(plan.planDate);
  const slotText = formatMealSlot(plan.mealSlot) || "这顿饭";
  if (event.status === "COMPLETED") return `${dateText} · ${slotText}已开饭`;
  if (event.status === "CANCELLED") return `${dateText} · ${slotText}已取消`;
  return `${dateText} · ${slotText}`;
}

function buildStatLine(acceptedCount: number, participantCount: number, menuCount: number, bringCount: number) {
  const segments = [`${acceptedCount}/${participantCount || 0} 已回应`, `${menuCount}道菜`];
  if (bringCount) segments.push(`${bringCount}人带菜`);
  return segments.join(" · ");
}

function resolveStage(
  event: DiningEventSummary,
  role: EventCardItem["role"],
  myStatus: DiningEventSummary["participants"][number]["status"] | null
): EventStage {
  if (event.status === "COMPLETED" || event.status === "CANCELLED") return "DONE";
  if (role === "PARTICIPANT" && myStatus === "INVITED") return "TODO";
  if (role === "ORGANIZER" && event.status === "PLANNED") return "TODO";
  return "ACTIVE";
}

function resolveFocusText(
  event: DiningEventSummary,
  role: EventCardItem["role"],
  myStatus: DiningEventSummary["participants"][number]["status"] | null
) {
  if (event.status === "COMPLETED") return "可看饭搭子卡";
  if (event.status === "CANCELLED") return "这场局已取消";
  if (role === "PARTICIPANT" && myStatus === "INVITED") return "等你回应";
  if (role === "PARTICIPANT" && myStatus === "DECLINED") return "你已拒绝";
  if (role === "PARTICIPANT" && myStatus === "REMOVED") return "已被移出";
  if (role === "ORGANIZER" && event.status === "PLANNED") return "待你继续推进";
  if (role === "ORGANIZER" && event.status === "CONFIRMED") return "待你收尾";
  return "";
}

function resolveStatusClass(status: DiningEventSummary["status"]) {
  if (status === "COMPLETED") return "event-card__badge--done";
  if (status === "CANCELLED") return "event-card__badge--cancelled";
  if (status === "CONFIRMED") return "event-card__badge--confirmed";
  return "event-card__badge--planned";
}

function formatEventStatus(status: DiningEventSummary["status"]) {
  if (status === "PLANNED") return "组织中";
  if (status === "CONFIRMED") return "已确认";
  if (status === "CANCELLED") return "已取消";
  return "已完成";
}

function buildScheduleText(value: string) {
  const fullText = formatDateTimeMinute(value, "");
  if (!fullText) return "时间待定";
  const [dateText, timeText] = fullText.split(" ");
  if (!dateText || !timeText) return fullText;
  return `${dateText.slice(5)} ${timeText}`;
}

function formatPlanDate(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) return value;
  return `${month}月${day}日`;
}

function compareCards(left: EventCardItem, right: EventCardItem, currentStage: EventStage) {
  if (currentStage === "DONE") return right.sortTime - left.sortTime;
  return left.sortTime - right.sortTime;
}

function changeStage(nextStage: EventStage) {
  if (stage.value === nextStage) return;
  stage.value = nextStage;
}

function changeRoleFilter(nextFilter: RoleFilter) {
  if (roleFilter.value === nextFilter) return;
  roleFilter.value = nextFilter;
  syncStageWithRole();
}

function syncStageWithRole() {
  if (stageCount(stage.value) > 0) return;
  const nextStage = stageTabs.find(item => stageCount(item.value) > 0)?.value;
  if (nextStage) {
    stage.value = nextStage;
  }
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
  createPlanDate.value = todayText();
  createMealSlot.value = "DINNER";
  createTime.value = resolveDefaultTime("DINNER");
  createSheetVisible.value = true;
}

function closeCreateSheet() {
  if (creatingEvent.value) return;
  createSheetVisible.value = false;
}

function handleCreateSheetAfterClose() {
  if (createSheetVisible.value) return;
}

function handleCreateDateChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  createPlanDate.value = nextValue;
}

function handleCreateTimeChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  createTime.value = nextValue;
}

function selectCreateMealSlot(nextSlot: MealPlanSummary["mealSlot"]) {
  if (createMealSlot.value === nextSlot) return;
  createMealSlot.value = nextSlot;
  createTime.value = resolveDefaultTime(nextSlot);
}

async function submitCreateEvent() {
  if (creatingEvent.value) return;
  creatingEvent.value = true;

  try {
    const result = await mealApi.createDirectDiningEvent({
      operationId: createOperationId(),
      planDate: createPlanDate.value,
      mealSlot: createMealSlot.value,
      scheduledAt: composeScheduledAt(createPlanDate.value, createTime.value),
      location: null
    });
    createSheetVisible.value = false;
    void uniPlatform.navigation.navigateTo(
      `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(result.planItemId))}&planDate=${encodeURIComponent(createPlanDate.value)}&eventId=${encodeURIComponent(String(result.id))}`
    );
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "发起失败", icon: "none" });
  } finally {
    creatingEvent.value = false;
  }
}

function goBack() {
  void uniPlatform.navigation.navigateBack();
}

function parseQueryText(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
}

function resolveDefaultTime(slot: MealPlanSummary["mealSlot"]) {
  return mealSlotDefaultTime(slot);
}

function composeScheduledAt(dateText: string, timeText: string) {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
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
  align-items: flex-end;
  min-width: 0;
  padding-top: 6rpx;
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
  background: var(--theme-primary);
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
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
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
  color: var(--color-primary-active);
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
  background: color-mix(in srgb, var(--color-surface-muted) 74%, transparent);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.notice--error {
  color: var(--color-danger);
}

.notice--soft {
  background: color-mix(in srgb, var(--color-warning-soft) 68%, var(--color-surface) 32%);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-top: 20rpx;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.event-card {
  padding: 24rpx;
  border-radius: 28rpx;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.event-card--hover {
  transform: translateY(-2rpx);
  box-shadow:
    0 20rpx 36rpx color-mix(in srgb, var(--color-surface-mask-strong) 20%, transparent),
    0 8rpx 18rpx color-mix(in srgb, var(--color-primary-soft) 14%, transparent);
}

.event-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.event-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.event-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42rpx;
  padding: 0 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;
}

.event-card__badge--role {
  background: color-mix(in srgb, var(--color-surface-muted) 78%, transparent);
  color: var(--color-text-secondary);
}

.event-card__badge--planned {
  background: color-mix(in srgb, var(--color-warning-soft) 78%, var(--color-surface) 22%);
  color: var(--color-warning-text);
}

.event-card__badge--confirmed,
.event-card__badge--done {
  background: color-mix(in srgb, var(--color-primary-soft) 78%, var(--color-surface) 22%);
  color: var(--color-primary);
}

.event-card__badge--cancelled {
  background: color-mix(in srgb, var(--color-danger-soft) 78%, var(--color-surface) 22%);
  color: var(--color-danger-text);
}

.event-card__focus {
  color: var(--color-warning-text);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
  text-align: right;
}

.event-card__main {
  margin-top: 18rpx;
}

.event-card__main-shell {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.event-card__main-shell--with-cover .event-card__main-text {
  min-width: 0;
  flex: 1;
}

.event-card__title {
  display: block;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 1.28;
}

.event-card__desc {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.event-card__cover {
  width: 140rpx;
  height: 108rpx;
  flex: 0 0 auto;
  border-radius: 20rpx;
  background: var(--color-surface-muted);
}

.event-card__rows {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 18rpx;
}

.event-card__row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.event-card__row-icon {
  width: 28rpx;
  margin-top: 2rpx;
  color: color-mix(in srgb, var(--color-text-secondary) 72%, transparent);
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
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.event-card__menu-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-primary-soft) 66%, var(--color-surface) 34%);
  color: var(--color-text);
  font-size: 22rpx;
}

.event-card__menu-chip--more {
  background: color-mix(in srgb, var(--color-surface-muted) 76%, transparent);
  color: var(--color-text-secondary);
}

.event-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid color-mix(in srgb, var(--color-border) 62%, transparent);
}

.event-card__organizer {
  flex: 1;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.event-card__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}

.page-empty {
  margin-top: 20rpx;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}

.sheet-field + .sheet-field {
  margin-top: 28rpx;
}

.sheet-field__label {
  display: block;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
}

.sheet-picker,
.sheet-input {
  display: flex;
  align-items: center;
  min-height: 88rpx;
  margin-top: 14rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 26rpx;
  box-sizing: border-box;
}

.sheet-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 14rpx;
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
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary-active);
}

.sheet-actions {
  display: flex;
  gap: 20rpx;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-actions__button {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 88rpx;
  border-radius: var(--radius-pill);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-actions__button--cancel {
  background: var(--color-surface-muted);
  color: var(--color-text);
}

.sheet-actions__button--confirm {
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
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
  background: linear-gradient(135deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%);
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
