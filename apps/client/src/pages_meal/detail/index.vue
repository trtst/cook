<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen navbar-layout="custom-left" :show-left="false">
    <template #navbar-left>
      <view class="meal-detail-nav">
        <view class="cookfont icon-back meal-detail-nav__back" hover-class="meal-detail-nav__back--hover" hover-stay-time="100" @click="goBack" />
        <text class="meal-detail-nav__title">{{ navTitle }}</text>
      </view>
    </template>

    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看餐次详情"
      description="安排这顿饭、继续发起饭局和查看参与情况，都需要登录后处理。"
    />

    <view v-else class="meal-detail-page">
      <view v-if="loading && !planDetail" class="meal-detail-state">加载中...</view>
      <view v-else-if="errorText && !planDetail" class="meal-detail-state meal-detail-state--error" @click="loadDetail">
        {{ errorText }}
      </view>
      <Empty v-else-if="!planDetail" title="未找到这条安排" description="可能已被删除，或当前日期范围里暂无这条餐次安排。" />

      <template v-else>
        <scroll-view scroll-y class="meal-detail-scroll" :show-scrollbar="false">
          <view class="meal-detail-body">
            <view class="meal-hero">
              <text class="meal-hero__eyebrow">{{ planDateText }}</text>
              <view class="meal-hero__title-row">
                <text class="meal-hero__title">{{ slotLabel(planDetail.mealSlot) }}</text>
                <text class="meal-hero__count">{{ currentMenuItems.length }}道菜</text>
              </view>
              <text v-if="heroMeta" class="meal-hero__meta">{{ heroMeta }}</text>
              <view class="meal-hero__tags">
                <text v-if="eventDetail" class="meal-hero__tag meal-hero__tag--accent">已关联饭局</text>
                <text v-if="planDetail.status === 'COMPLETED'" class="meal-hero__tag meal-hero__tag--done">已完成</text>
                <text v-if="eventDetail?.completedAt" class="meal-hero__tag meal-hero__tag--done">饭局已完成</text>
              </view>
            </view>

            <view class="meal-panel">
              <view class="meal-panel__head">
                <text class="meal-panel__title">菜单安排</text>
                <text class="meal-panel__meta">{{ summarizeMenu(currentMenuItems) }}</text>
              </view>

              <view class="meal-menu">
                <view
                  v-for="item in currentMenuItems"
                  :key="item.key"
                  :class="['meal-menu__item', item.recipeId ? 'meal-menu__item--link' : '']"
                  :hover-class="item.recipeId ? 'meal-menu__item--hover' : ''"
                  hover-stay-time="100"
                  @click="openRecipeDetail(item.recipeId)"
                >
                  <text class="meal-menu__name">{{ item.title }}</text>
                  <text v-if="item.meta" class="meal-menu__meta">{{ item.meta }}</text>
                </view>
              </view>
            </view>

            <view v-if="planDetail" class="meal-panel">
              <view class="meal-panel__head meal-panel__head--row">
                <view class="meal-panel__head-main">
                  <text class="meal-panel__title">做饭助手</text>
                  <text class="meal-panel__meta">{{ cookAssistantMeta }}</text>
                </view>
                <view
                  :class="['meal-inline-action', cookAssistantLoading || submitting ? 'meal-inline-action--disabled' : '']"
                  @click="handleCookAssistantAction"
                >
                  {{ cookAssistantActionText }}
                </view>
              </view>

              <view v-if="cookAssistant?.isStale" class="meal-helper-banner">
                <text class="meal-helper-banner__title">当前菜单已变更</text>
                <text class="meal-helper-banner__text">这份流程基于旧菜单生成，请重新生成后再按它开做。</text>
              </view>

              <view v-if="cookAssistantLoading && !cookAssistant?.hasSnapshot" class="meal-helper-state">
                正在准备这顿饭的流程安排...
              </view>

              <view v-else-if="cookAssistant?.hasSnapshot" class="meal-helper">
                <view class="meal-helper__summary">
                  <view class="meal-helper__summary-item">
                    <text class="meal-helper__summary-label">前期准备</text>
                    <text class="meal-helper__summary-value">{{ cookAssistant.summary.prepTaskCount }}项</text>
                  </view>
                  <view class="meal-helper__summary-item">
                    <text class="meal-helper__summary-label">开做步骤</text>
                    <text class="meal-helper__summary-value">{{ cookAssistant.summary.timelineStepCount }}步</text>
                  </view>
                  <view class="meal-helper__summary-item">
                    <text class="meal-helper__summary-label">预计总时长</text>
                    <text class="meal-helper__summary-value">{{ cookAssistant.summary.totalDurationText || "待估算" }}</text>
                  </view>
                  <view class="meal-helper__summary-item">
                    <text class="meal-helper__summary-label">建议开做</text>
                    <text class="meal-helper__summary-value">{{ cookAssistant.summary.suggestedStartTime || "按这顿饭时间倒推" }}</text>
                  </view>
                </view>

                <view v-if="cookAssistant.prepTasks.length" class="meal-helper__section">
                  <text class="meal-helper__section-title">前期准备</text>
                  <view v-for="(item, index) in cookAssistant.prepTasks" :key="`prep-${index}`" class="meal-helper__item">
                    <text class="meal-helper__item-title">{{ item.title }}</text>
                    <text class="meal-helper__item-text">{{ item.detail }}</text>
                  </view>
                </view>

                <view v-if="cookAssistant.cookTimeline.length" class="meal-helper__section">
                  <text class="meal-helper__section-title">开做顺序</text>
                  <view v-for="item in cookAssistant.cookTimeline" :key="`timeline-${item.order}`" class="meal-helper__item">
                    <text class="meal-helper__item-title">步骤 {{ item.order }} · {{ item.title }}</text>
                    <text class="meal-helper__item-text">{{ item.detail }}</text>
                  </view>
                </view>

                <view v-if="cookAssistant.serveTasks.length" class="meal-helper__section">
                  <text class="meal-helper__section-title">收尾上桌</text>
                  <view v-for="(item, index) in cookAssistant.serveTasks" :key="`serve-${index}`" class="meal-helper__item">
                    <text class="meal-helper__item-title">{{ item.title }}</text>
                    <text class="meal-helper__item-text">{{ item.detail }}</text>
                  </view>
                </view>

                <view v-if="cookAssistant.summary.notes.length" class="meal-helper__section">
                  <text class="meal-helper__section-title">提醒</text>
                  <view v-for="(item, index) in cookAssistant.summary.notes" :key="`note-${index}`" class="meal-helper__note">
                    {{ item }}
                  </view>
                </view>
              </view>

              <view v-else class="meal-helper-state">
                还没有这顿饭的做饭安排，点右上角生成一次，后续会挂在这个计划下。
              </view>
            </view>

            <view v-if="eventErrorText && !eventDetail" class="meal-panel meal-panel--warning" @click="loadDetail">
              <text class="meal-panel__title">饭局信息暂时加载失败</text>
              <text class="meal-panel__meta">{{ eventErrorText }}</text>
            </view>

            <view v-if="eventDetail" class="meal-panel">
              <view class="meal-panel__head">
                <text class="meal-panel__title">饭局信息</text>
                <text class="meal-panel__meta">{{ eventDetail.title || "这顿饭" }}</text>
              </view>

              <view class="meal-summary">
                <view class="meal-summary__item">
                  <text class="meal-summary__label">状态</text>
                  <text class="meal-summary__value">{{ formatEventStatus(eventDetail.status) }}</text>
                </view>
                <view class="meal-summary__item">
                  <text class="meal-summary__label">时间地点</text>
                  <text class="meal-summary__value">{{ eventScheduleText }}</text>
                </view>
                <view class="meal-summary__item">
                  <text class="meal-summary__label">已接受</text>
                  <text class="meal-summary__value">{{ acceptedCount }}人</text>
                </view>
                <view class="meal-summary__item">
                  <text class="meal-summary__label">待处理</text>
                  <text class="meal-summary__value">{{ pendingCount }}人</text>
                </view>
              </view>
            </view>

            <view v-else-if="showEventEditor" class="meal-panel">
              <view class="meal-panel__head">
                <text class="meal-panel__title">发起饭局</text>
                <text class="meal-panel__meta">把这顿饭补上时间和地点，后续邀请和分享仍从这个餐次详情继续展开。</text>
              </view>

              <view class="field-block">
                <text class="field-block__label">日期</text>
                <picker mode="date" :value="scheduledDate" @change="handleDateChange">
                  <view class="field-block__value">{{ scheduledDate }}</view>
                </picker>
              </view>

              <view class="field-block">
                <text class="field-block__label">时间</text>
                <picker mode="time" :value="scheduledTime" @change="handleTimeChange">
                  <view class="field-block__value">{{ scheduledTime }}</view>
                </picker>
              </view>

              <view class="field-block">
                <text class="field-block__label">地点</text>
                <input v-model="location" class="field-block__input" maxlength="20" placeholder="例如 家里（可选）" />
              </view>

              <view class="field-actions">
                <view class="field-actions__button field-actions__button--ghost" @click="closeEventEditor">先不发起</view>
                <view class="field-actions__button field-actions__button--primary" @click="createEvent">
                  {{ submitting ? "创建中..." : "确认发起饭局" }}
                </view>
              </view>
            </view>

            <view v-if="eventDetail" class="meal-panel">
              <view class="meal-panel__head">
                <text class="meal-panel__title">参与情况</text>
                <text class="meal-panel__meta">
                  {{ eventDetail.participants.length ? "这场饭局的参与人和带菜情况都收口在这里。" : "这场饭局还没有额外参与人。" }}
                </text>
              </view>

              <view v-if="eventDetail.participants.length" class="participant-list">
                <view v-for="item in eventDetail.participants" :key="item.id" class="participant-row">
                  <text class="participant-row__name">{{ item.displayName || item.guestName || `UID ${item.userUid ?? "--"}` }}</text>
                  <text class="participant-row__meta">{{ formatParticipantStatus(item.status, item.bringRecipeTitle) }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="meal-actions">
          <view
            v-if="eventDetail?.shareTokenPath"
            class="meal-actions__button meal-actions__button--ghost"
            @click="openSharePreview"
          >
            查看分享
          </view>
          <view
            v-else-if="canCreateEvent"
            class="meal-actions__button meal-actions__button--ghost"
            @click="openEventEditor"
          >
            {{ showEventEditor ? "继续填写饭局" : "发起饭局" }}
          </view>
          <view
            v-if="eventDetail?.completedAt"
            class="meal-actions__button meal-actions__button--ghost"
            @click="openMemory"
          >
            看饭搭子卡
          </view>
          <view
            v-else-if="!eventDetail && planDetail.status !== 'COMPLETED'"
            class="meal-actions__button meal-actions__button--ghost"
            @click="openPlanEditor(planDetail)"
          >
            调整菜谱
          </view>
          <view
            v-if="canCompleteEvent"
            class="meal-actions__button meal-actions__button--primary"
            @click="markEventDone"
          >
            标记饭局完成
          </view>
          <view
            v-else-if="planDetail.status !== 'COMPLETED'"
            class="meal-actions__button meal-actions__button--primary"
            @click="markPlanDone(planDetail)"
          >
            标记完成
          </view>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { mealApi, type DiningEventSummary, type MealPlanCookAssistant, type MealPlanSummary } from "@/apis/meal";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { formatMealSlot, mealSlotDefaultTime } from "@/utils/meal-slot";
import { formatDateTimeMinute } from "../utils/date";

type MealSlot = MealPlanSummary["mealSlot"];
type MenuEntry = {
  key: string;
  title: string;
  meta: string;
  recipeId: UUID | null;
};

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const eventErrorText = ref("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const eventId = ref<UUID | "">("");
const planDetail = ref<MealPlanSummary | null>(null);
const eventDetail = ref<DiningEventSummary | null>(null);
const showEventEditor = ref(false);
const scheduledDate = ref("");
const scheduledTime = ref("18:30");
const location = ref("");
const cookAssistantLoading = ref(false);
const cookAssistant = ref<MealPlanCookAssistant | null>(null);

const navTitle = computed(() => (eventDetail.value ? "餐次详情 · 饭局" : "餐次详情"));
const planDateText = computed(() => formatPlanDate(planDetail.value?.planDate || planDate.value));
const heroMeta = computed(() => {
  if (!eventDetail.value) return "";
  return [formatDateTimeMinute(eventDetail.value.scheduledAt), eventDetail.value.location || "未填写地点"].join(" · ");
});
const eventScheduleText = computed(() => {
  if (!eventDetail.value) return "";
  return [formatDateTimeMinute(eventDetail.value.scheduledAt), eventDetail.value.location || "未填写地点"].join(" · ");
});
const currentMenuItems = computed<MenuEntry[]>(() => {
  if (eventDetail.value) {
    return eventDetail.value.menuItems.map(item => ({
      key: `event-${item.id}`,
      title: item.title,
      meta: resolveCookText(item.cookName),
      recipeId: item.recipeId
    }));
  }

  return (planDetail.value?.menuItems ?? []).map(item => ({
    key: `plan-${item.recipeVersionId}`,
    title: item.title,
    meta: item.servings ? `${item.servings}人份` : "",
    recipeId: item.recipeId
  }));
});
const acceptedCount = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status === "ACCEPTED").length);
const pendingCount = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status === "INVITED").length);
const canCreateEvent = computed(() =>
  Boolean(
    planDetail.value &&
      planDetail.value.status !== "COMPLETED" &&
      !planDetail.value.hasDiningEvent &&
      !eventDetail.value
  )
);
const canCompleteEvent = computed(() => Boolean(eventDetail.value && eventDetail.value.status !== "COMPLETED"));
const cookAssistantMeta = computed(() => {
  if (cookAssistantLoading.value && !cookAssistant.value?.hasSnapshot) return "正在生成这顿饭的流程安排";
  if (!cookAssistant.value?.hasSnapshot) return "把这顿饭的准备顺序和开做节奏收成一份可执行安排";
  if (cookAssistant.value.isStale) return "这份安排基于旧菜单，建议重新生成";
  return cookAssistant.value.generatedAt ? `最近生成于 ${formatDateTimeMinute(cookAssistant.value.generatedAt)}` : "已生成";
});
const cookAssistantActionText = computed(() => {
  if (cookAssistantLoading.value) return "处理中...";
  if (!cookAssistant.value?.hasSnapshot) return "生成";
  return cookAssistant.value.isStale ? "重新生成" : "刷新";
});

onLoad(query => {
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  eventId.value = parseQueryId(query?.eventId);
  showEventEditor.value = parseQueryText(query?.mode) === "create-event";
});

onShow(() => {
  void loadDetail();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      clearPageState();
      return;
    }
    void loadDetail();
  }
);

async function loadDetail() {
  if (!sessionStore.isLoggedIn) {
    clearPageState();
    return;
  }
  if (!planItemId.value || !planDate.value || loading.value) return;

  loading.value = true;
  errorText.value = "";
  eventErrorText.value = "";
  try {
    const result = await mealApi.listPlans({ from: planDate.value, to: planDate.value, page: 1, pageSize: 10 });
    const nextPlan = result.items.find(item => item.id === planItemId.value) ?? null;
    planDetail.value = nextPlan;
    if (!nextPlan) {
      errorText.value = "这条餐次暂时找不到了，点此重试";
      eventDetail.value = null;
      cookAssistant.value = null;
      return;
    }

    resetEventDraft(nextPlan);
    await loadCookAssistant(nextPlan.id);
    const targetEventId = eventId.value || nextPlan.diningEventId;
    if (!targetEventId) {
      eventDetail.value = null;
      return;
    }

    try {
      eventDetail.value = await mealApi.getDiningEvent(targetEventId);
      eventId.value = eventDetail.value.id;
      showEventEditor.value = false;
    } catch (error) {
      eventDetail.value = null;
      eventErrorText.value = error instanceof Error ? error.message : "点此重试加载饭局信息";
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "餐次加载失败，点此重试";
  } finally {
    loading.value = false;
  }
}

function clearPageState() {
  loading.value = false;
  submitting.value = false;
  errorText.value = "";
  eventErrorText.value = "";
  planDetail.value = null;
  eventDetail.value = null;
  cookAssistant.value = null;
  cookAssistantLoading.value = false;
  showEventEditor.value = false;
}

function resetEventDraft(plan: MealPlanSummary) {
  if (eventDetail.value || !showEventEditor.value) return;
  scheduledDate.value = plan.planDate || todayText();
  scheduledTime.value = resolveDefaultTime(plan.mealSlot);
  location.value = "";
}

function summarizeMenu(items: MenuEntry[]) {
  return items.map(item => item.title).join(" · ");
}

function slotLabel(slot: MealSlot) {
  return formatMealSlot(slot);
}

function formatPlanDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "这一天";
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日`;
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

function openRecipeDetail(recipeId: UUID | null) {
  if (!recipeId) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=my`);
}

function openPlanEditor(plan: MealPlanSummary) {
  void uniPlatform.navigation.navigateTo(
    `/pages_meal/plan/index?date=${encodeURIComponent(plan.planDate)}&planItemId=${encodeURIComponent(String(plan.id))}`
  );
}

function openEventEditor() {
  if (!planDetail.value) return;
  showEventEditor.value = true;
  resetEventDraft(planDetail.value);
}

function closeEventEditor() {
  showEventEditor.value = false;
}

function handleDateChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  scheduledDate.value = nextValue;
}

function handleTimeChange(event: { detail?: { value?: string } }) {
  const nextValue = event.detail?.value?.trim();
  if (!nextValue) return;
  scheduledTime.value = nextValue;
}

async function createEvent() {
  if (!planDetail.value || submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.createDiningEvent(planDetail.value.id, {
      operationId: createOperationId(),
      scheduledAt: composeScheduledAt(
        scheduledDate.value || planDetail.value.planDate || todayText(),
        scheduledTime.value || resolveDefaultTime(planDetail.value.mealSlot)
      ),
      location: location.value.trim() || null
    });
    eventId.value = result.id;
    eventDetail.value = result;
    planDetail.value = {
      ...planDetail.value,
      hasDiningEvent: true,
      diningEventId: result.id
    };
    showEventEditor.value = false;
    await uniPlatform.feedback.toast({ title: "饭局已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function loadCookAssistant(currentPlanItemId: UUID) {
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.getCookAssistant(currentPlanItemId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("计划不存在")) {
      cookAssistant.value = null;
      return;
    }
    if (!cookAssistant.value?.hasSnapshot) {
      cookAssistant.value = null;
    }
  } finally {
    cookAssistantLoading.value = false;
  }
}

async function handleCookAssistantAction() {
  if (!planDetail.value || cookAssistantLoading.value || submitting.value) return;
  cookAssistantLoading.value = true;
  try {
    cookAssistant.value = await mealApi.generateCookAssistant(planDetail.value.id, {
      operationId: createOperationId()
    });
    await uniPlatform.feedback.toast({ title: cookAssistant.value.isStale ? "已重新生成" : "已生成做饭安排", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "生成失败", icon: "none" });
  } finally {
    cookAssistantLoading.value = false;
  }
}

function resolveCookText(cookName: string | null) {
  return cookName?.trim() ? `${cookName} 来做` : "待认领";
}

function formatEventStatus(status: DiningEventSummary["status"]) {
  if (status === "PLANNED") return "待确认";
  if (status === "CONFIRMED") return "已确认";
  if (status === "CANCELLED") return "已取消";
  return "已完成";
}

function formatParticipantStatus(status: DiningEventSummary["participants"][number]["status"], bringRecipeTitle: string | null) {
  if (status === "ACCEPTED") {
    return bringRecipeTitle?.trim() ? `已接受 · 我带${bringRecipeTitle.trim()}` : "已接受";
  }
  if (status === "DECLINED") return "已拒绝";
  if (status === "REMOVED") return "已移除";
  return "待回应";
}

function resolveDefaultTime(slot: MealSlot) {
  return mealSlotDefaultTime(slot);
}

function composeScheduledAt(dateText: string, timeText: string) {
  const localDate = new Date(`${dateText}T${timeText}:00`);
  return localDate.toISOString();
}

function todayText() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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
    planDetail.value = await mealApi.completePlan(plan.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "已标记完成", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

async function markEventDone() {
  if (!eventDetail.value || submitting.value) return;
  const confirmed = await uniPlatform.feedback.confirm({
    title: "完成饭局",
    content: "确认把这场饭局标记为已完成吗？"
  });
  if (!confirmed) return;

  submitting.value = true;
  try {
    eventDetail.value = await mealApi.completeDiningEvent(eventDetail.value.id, createOperationId());
    await uniPlatform.feedback.toast({ title: "饭局已完成", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

function openSharePreview() {
  if (!eventDetail.value?.shareTokenPath) return;
  void uniPlatform.navigation.navigateTo(eventDetail.value.shareTokenPath);
}

function openMemory() {
  if (!eventId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId.value))}`);
}

function goBack() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  });
}
</script>

<style scoped lang="scss">
.meal-detail-page {
  display: flex;
  flex: 1;
  min-height: 0;
}

.meal-detail-nav {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.meal-detail-nav__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-text) 8%, var(--color-surface));
  color: var(--color-text);
  font-size: 28rpx;
}

.meal-detail-nav__back--hover {
  opacity: 0.82;
}

.meal-detail-nav__title {
  min-width: 0;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.meal-detail-state {
  padding: 48rpx var(--space-page);
  color: var(--color-text-secondary);
}

.meal-detail-state--error {
  color: var(--color-danger);
}

.meal-detail-scroll {
  flex: 1;
  min-height: 0;
}

.meal-detail-body {
  padding: var(--space-page);
  padding-bottom: 220rpx;
}

.meal-hero {
  padding: 40rpx 36rpx;
  border-radius: 36rpx;
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--theme-primary) 20%, transparent) 0%, transparent 44%),
    linear-gradient(180deg, var(--color-surface) 0%, var(--color-page) 100%);
  box-shadow: 0 20rpx 56rpx rgba(77, 61, 44, 0.08);
}

.meal-hero__eyebrow {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.meal-hero__title-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 18rpx;
}

.meal-hero__title {
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: 700;
}

.meal-hero__count {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.meal-hero__meta {
  display: block;
  margin-top: 20rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 24rpx;
}

.meal-hero__tag {
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--color-text) 6%, var(--color-surface));
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.meal-hero__tag--accent {
  background: color-mix(in srgb, var(--theme-primary) 16%, var(--color-surface));
  color: var(--theme-primary);
}

.meal-hero__tag--done {
  background: color-mix(in srgb, var(--color-success) 16%, var(--color-surface));
  color: var(--color-success);
}

.meal-panel {
  margin-top: 28rpx;
  padding: 32rpx;
  border-radius: 32rpx;
  background: var(--color-surface);
  box-shadow: 0 16rpx 44rpx rgba(77, 61, 44, 0.06);
}

.meal-panel--warning {
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
}

.meal-panel__head {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.meal-panel__head--row {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.meal-panel__head-main {
  min-width: 0;
  flex: 1;
}

.meal-panel__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
}

.meal-panel__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.meal-inline-action {
  flex-shrink: 0;
  padding: 14rpx 26rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
  color: var(--theme-primary);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-inline-action--disabled {
  opacity: 0.56;
}

.meal-menu {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 28rpx;
}

.meal-menu__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--theme-primary) 6%, var(--color-surface));
}

.meal-menu__item--link {
  transition: transform 160ms ease, opacity 160ms ease;
}

.meal-menu__item--hover {
  transform: translateY(-2rpx);
  opacity: 0.92;
}

.meal-menu__name {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.meal-menu__meta {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  text-align: right;
}

.meal-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 28rpx;
}

.meal-summary__item {
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.meal-summary__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.meal-summary__value {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-helper-banner {
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--color-warning) 10%, var(--color-surface));
}

.meal-helper-banner__title {
  display: block;
  color: var(--color-warning);
  font-size: 24rpx;
  font-weight: 600;
}

.meal-helper-banner__text {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.meal-helper-state {
  margin-top: 24rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.meal-helper {
  margin-top: 24rpx;
}

.meal-helper__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.meal-helper__summary-item {
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--theme-primary) 6%, var(--color-surface));
}

.meal-helper__summary-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.meal-helper__summary-value {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
}

.meal-helper__section {
  margin-top: 28rpx;
}

.meal-helper__section-title {
  display: block;
  color: var(--color-text);
  font-size: 26rpx;
  font-weight: 700;
}

.meal-helper__item {
  margin-top: 16rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
}

.meal-helper__item-title {
  display: block;
  color: var(--color-text);
  font-size: 25rpx;
  font-weight: 600;
}

.meal-helper__item-text {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.7;
}

.meal-helper__note {
  margin-top: 14rpx;
  padding: 18rpx 22rpx;
  border-radius: 22rpx;
  background: color-mix(in srgb, var(--color-text) 4%, var(--color-surface));
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.participant-list {
  margin-top: 20rpx;
}

.participant-row {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.participant-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.participant-row__name {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 600;
}

.participant-row__meta {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.field-block + .field-block {
  margin-top: 20rpx;
}

.field-block {
  margin-top: 28rpx;
}

.field-block__label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.field-block__value,
.field-block__input {
  margin-top: 10rpx;
  padding: 22rpx 24rpx;
  border-radius: 24rpx;
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.field-block__input {
  width: 100%;
  border: 1rpx solid var(--color-border);
}

.field-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.field-actions__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.field-actions__button--ghost {
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
  color: var(--color-text);
}

.field-actions__button--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}

.meal-actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  gap: 20rpx;
  padding: 24rpx var(--space-page) calc(24rpx + env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(18rpx);
}

.meal-actions__button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 600;
}

.meal-actions__button--ghost {
  background: color-mix(in srgb, var(--theme-primary) 8%, var(--color-surface));
  color: var(--color-text);
}

.meal-actions__button--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  box-shadow: var(--button-primary-shadow);
}
</style>
