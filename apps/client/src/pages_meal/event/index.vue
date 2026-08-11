<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="饭局">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后处理这场饭局"
      description="先定下时间和地点，再继续邀请或生成公开卡片。"
    />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadPage">
        <text class="notice__text">{{ errorText }}</text>
        <text class="notice__action">重新加载</text>
      </view>

      <view v-else-if="loading && !eventDetail" class="notice">
        <text class="notice__text">饭局加载中...</text>
      </view>

      <view v-else-if="!eventDetail && !canCreate" class="empty-wrap">
        <Empty title="没有可处理的饭局" description="从计划页发起一顿饭局，或从已有餐次打开对应摘要。" />
      </view>

      <template v-else>
        <view class="hero-card">
          <text class="hero-card__eyebrow">{{ eventDetail ? "饭局摘要" : "从计划发起" }}</text>
          <text class="hero-card__title">{{ displayTitle }}</text>
          <text v-if="displayMeta" class="hero-card__meta">{{ displayMeta }}</text>
          <text v-if="displaySubMeta" class="hero-card__sub-meta">{{ displaySubMeta }}</text>
        </view>

        <template v-if="eventDetail">
          <view class="summary-card">
            <view class="summary-item">
              <text class="summary-item__label">状态</text>
              <text class="summary-item__value">{{ formatEventStatus(eventDetail.status) }}</text>
            </view>
            <view class="summary-item">
              <text class="summary-item__label">菜单</text>
              <text class="summary-item__value">{{ eventDetail.menuItems.length }} 道</text>
            </view>
            <view class="summary-item">
              <text class="summary-item__label">已接受</text>
              <text class="summary-item__value">{{ acceptedCount }} 人</text>
            </view>
            <view class="summary-item">
              <text class="summary-item__label">待处理</text>
              <text class="summary-item__value">{{ pendingCount }} 人</text>
            </view>
          </view>

          <view class="section-card">
            <text class="section-card__title">这顿饭吃什么</text>
            <view class="menu-list">
              <view v-for="item in eventDetail.menuItems" :key="item.id" class="menu-row">
                <text class="menu-row__title">{{ item.title }}</text>
                <text class="menu-row__meta">{{ resolveCookText(item.cookName) }}</text>
              </view>
            </view>
          </view>

          <view class="section-card">
            <text class="section-card__title">参与情况</text>
            <view v-if="eventDetail.participants.length" class="participant-list">
              <view v-for="item in eventDetail.participants" :key="item.id" class="participant-row">
                <text class="participant-row__name">{{ item.displayName || item.guestName || `UID ${item.userUid ?? "--"}` }}</text>
                <text class="participant-row__meta">{{ formatParticipantStatus(item.status, item.bringRecipeTitle) }}</text>
              </view>
            </view>
            <text v-else class="section-card__hint">这场饭局还没有额外参与人，后续邀请会从这里收口显示。</text>
          </view>

          <view class="section-card">
            <text class="section-card__title">下一步</text>
            <view class="action-row">
              <button v-if="eventDetail.shareTokenPath" class="secondary" @click="openSharePreview">查看分享预览</button>
              <button v-if="eventDetail.completedAt" class="secondary" @click="openMemory">看饭搭子卡</button>
              <button class="secondary" @click="goBackToPlan">回到计划</button>
            </view>
            <text class="section-card__hint">
              计划页只保留这场饭局的轻入口；更细的邀请、带菜和公开卡片动作都从这里继续展开。
            </text>
          </view>
        </template>

        <template v-else-if="canCreate">
          <view class="section-card">
            <text class="section-card__title">安排开饭时间</text>
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
              <input v-model="location" class="input" maxlength="20" placeholder="例如 家里（可选）" />
            </view>
          </view>

          <view class="section-card">
            <text class="section-card__title">创建后你会看到</text>
            <text class="section-card__hint">先生成这场饭局的最小摘要：时间、地点、菜单和参与情况。更细的邀请和公开分享后续再继续补。</text>
            <view class="action-row">
              <button class="primary" :disabled="submitting" @click="createEvent">
                {{ submitting ? "创建中..." : "确认发起饭局" }}
              </button>
              <button class="secondary" @click="goBackToPlan">回到计划</button>
            </view>
          </view>
        </template>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";
import { mealApi, type DiningEventSummary, type MealPlanSummary } from "../apis/meal";
import { formatDateTimeMinute } from "../utils/date";

type MealSlot = MealPlanSummary["mealSlot"];

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const eventId = ref<UUID | "">("");
const planItemId = ref<UUID | "">("");
const planDate = ref("");
const mealSlot = ref<MealSlot>("DINNER");
const title = ref("");
const scheduledDate = ref("");
const scheduledTime = ref("18:30");
const location = ref("");
const eventDetail = ref<DiningEventSummary | null>(null);

const canCreate = computed(() => Boolean(planItemId.value && planDate.value && !eventId.value));
const displayTitle = computed(() => eventDetail.value?.title || title.value || "这顿饭");
const displayMeta = computed(() => {
  if (planDate.value) {
    return `${planDate.value} · ${formatMealSlot(mealSlot.value)}`;
  }
  if (!eventDetail.value) return "";
  return [formatDateTimeMinute(eventDetail.value.scheduledAt), eventDetail.value.location].filter(Boolean).join(" · ");
});
const displaySubMeta = computed(() => {
  if (!eventDetail.value) return "";
  return [formatDateTimeMinute(eventDetail.value.scheduledAt), eventDetail.value.location || "未填写地点"].join(" · ");
});
const acceptedCount = computed(() => (eventDetail.value?.participants ?? []).filter(item => item.status === "ACCEPTED").length);
const pendingCount = computed(() =>
  (eventDetail.value?.participants ?? []).filter(item => item.status === "INVITED").length
);

onLoad(query => {
  eventId.value = parseQueryId(query?.eventId);
  planItemId.value = parseQueryId(query?.planItemId);
  planDate.value = parseQueryText(query?.planDate);
  title.value = parseQueryText(query?.title);
  mealSlot.value = parseMealSlot(query?.mealSlot);
  scheduledDate.value = planDate.value || todayText();
  scheduledTime.value = resolveDefaultTime(mealSlot.value);
});

onShow(() => {
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

async function loadPage() {
  if (!sessionStore.isLoggedIn) {
    clearPageState();
    return;
  }
  if (!eventId.value) return;

  loading.value = true;
  errorText.value = "";
  try {
    eventDetail.value = await mealApi.getDiningEvent(eventId.value);
  } catch (error) {
    eventDetail.value = null;
    errorText.value = error instanceof Error ? error.message : "饭局加载失败";
  } finally {
    loading.value = false;
  }
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
  if (!planItemId.value || submitting.value) return;
  submitting.value = true;
  try {
    const result = await mealApi.createDiningEvent(planItemId.value, {
      operationId: createOperationId(),
      scheduledAt: composeScheduledAt(scheduledDate.value || todayText(), scheduledTime.value || resolveDefaultTime(mealSlot.value)),
      location: location.value.trim() || null
    });
    eventId.value = result.id;
    eventDetail.value = result;
    await uniPlatform.feedback.toast({ title: "饭局已创建", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "创建失败", icon: "none" });
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

function goBackToPlan() {
  void uniPlatform.navigation.navigateBack().catch(() => {
    void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
  });
}

function clearPageState() {
  eventDetail.value = null;
  loading.value = false;
  submitting.value = false;
  errorText.value = "";
}

function resolveCookText(cookName: string | null) {
  return cookName?.trim() ? `${cookName} 来做` : "待认领";
}

function formatMealSlot(slot: MealSlot) {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  return "晚餐";
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
  if (slot === "BREAKFAST") return "08:00";
  if (slot === "LUNCH") return "12:00";
  return "18:30";
}

function composeScheduledAt(dateText: string, timeText: string) {
  const localDate = new Date(`${dateText}T${timeText}:00`);
  return localDate.toISOString();
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

function parseMealSlot(value: unknown): MealSlot {
  const raw = parseQueryText(value);
  return raw === "BREAKFAST" || raw === "LUNCH" || raw === "DINNER" ? raw : "DINNER";
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
.notice,
.hero-card,
.summary-card,
.section-card {
  margin: var(--space-md) var(--space-page) 0;
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.empty-wrap {
  margin: var(--space-md) var(--space-page) 0;
}

.notice__text,
.notice__action,
.hero-card__eyebrow,
.hero-card__title,
.hero-card__meta,
.hero-card__sub-meta,
.section-card__title,
.section-card__hint,
.summary-item__label,
.summary-item__value,
.menu-row__title,
.menu-row__meta,
.participant-row__name,
.participant-row__meta,
.field-block__label,
.field-block__value {
  display: block;
}

.hero-card {
  background: linear-gradient(180deg, rgba(244, 108, 83, 0.14) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.hero-card__eyebrow {
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
}

.hero-card__title {
  margin-top: var(--space-xs);
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
}

.hero-card__meta,
.hero-card__sub-meta,
.section-card__hint,
.menu-row__meta,
.participant-row__meta {
  margin-top: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.7;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-md);
}

.summary-item {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.summary-item__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.summary-item__value {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-semibold);
}

.section-card__title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: var(--font-weight-heavy);
}

.menu-list,
.participant-list {
  margin-top: var(--space-sm);
}

.menu-row,
.participant-row {
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.menu-row:last-child,
.participant-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.menu-row__title,
.participant-row__name {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
}

.field-block + .field-block {
  margin-top: var(--space-sm);
}

.field-block {
  margin-top: var(--space-sm);
}

.field-block__label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.field-block__value,
.input {
  margin-top: 10rpx;
  padding: 22rpx 24rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: 28rpx;
  box-sizing: border-box;
}

.input {
  width: 100%;
  border: 1rpx solid var(--color-border);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.primary,
.secondary {
  border-radius: var(--radius-md);
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
