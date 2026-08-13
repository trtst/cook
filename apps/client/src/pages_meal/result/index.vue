<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="结果汇总">
    <Login
      v-if="!sessionStore.isLoggedIn"
      title="登录后查看结果汇总"
      description="看看这轮点菜征集最后怎么收口，再决定下一步谁来做。"
    />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadPage(true)">
        <text class="notice__text">{{ errorText }}</text>
        <text class="notice__action">重新加载</text>
      </view>

      <view v-if="!currentDiningGroupId && !pollId" class="empty-wrap">
        <Empty title="还没有可查看的征集" description="先进入当前饭搭子或从首页征集入口打开结果汇总。" />
      </view>

      <view v-else-if="loading && !pollDetail" class="notice">
        <text class="notice__text">结果汇总加载中...</text>
      </view>

      <template v-else-if="pollDetail">
        <view class="hero-card">
          <text class="hero-card__eyebrow">{{ currentDiningGroupName }}</text>
          <text class="hero-card__title">{{ pollDetail.title }}</text>
          <text class="hero-card__description">
            {{ pollDetail.planDate }} · {{ formatMealSlot(pollDetail.mealSlot) }} · {{ formatStatus(pollDetail.status) }}
          </text>
        </view>

        <view class="summary-card">
          <view class="summary-item">
            <text class="summary-item__label">已回应</text>
            <text class="summary-item__value">{{ pollDetail.responses.length }} 人</text>
          </view>
          <view class="summary-item">
            <text class="summary-item__label">候选菜</text>
            <text class="summary-item__value">{{ pollDetail.candidates.length }} 道</text>
          </view>
          <view class="summary-item">
            <text class="summary-item__label">建议菜</text>
            <text class="summary-item__value">{{ suggestionCount }} 道</text>
          </view>
          <view class="summary-item">
            <text class="summary-item__label">成员备注</text>
            <text class="summary-item__value">{{ noteCount }} 条</text>
          </view>
        </view>

        <view class="section-card">
          <text class="section-card__title">投票结果</text>
          <view class="rank-list">
            <view v-for="candidate in rankedCandidates" :key="candidate.id" class="rank-row">
              <view class="rank-row__rank">
                <text class="rank-row__rank-text">{{ candidate.rank }}</text>
              </view>
              <view class="rank-row__main">
                <view class="rank-row__title-line">
                  <text class="rank-row__title">{{ candidate.title }}</text>
                  <text v-if="candidate.sourceType === 'SUGGESTION'" class="rank-row__badge">建议菜</text>
                </view>
                <text class="rank-row__meta">
                  {{ candidate.voteCount }} 票
                  <text v-if="candidate.status !== 'ACTIVE'"> · {{ candidate.status === "PENDING" ? "待主理人确认" : "已拒绝" }}</text>
                </text>
              </view>
              <text class="rank-row__votes">{{ candidate.voteCount }}</text>
            </view>
          </view>
        </view>

        <view v-if="noteList.length" class="section-card">
          <text class="section-card__title">成员备注</text>
          <view class="note-list">
            <view v-for="item in noteList" :key="item.id" class="note-row">
              <text class="note-row__title">UID {{ item.userUid }}</text>
              <text class="note-row__text">{{ item.note }}</text>
            </view>
          </view>
        </view>

        <view class="section-card">
          <text class="section-card__title">下一步</text>
          <view class="action-row">
            <button class="secondary" @click="openPoll">回到征集页</button>
            <button v-if="pollDetail.confirmedDiningEventId" class="secondary" @click="openMemory(pollDetail.confirmedDiningEventId)">
              看饭搭子卡
            </button>
            <button v-else-if="pollDetail.confirmedPlanItemId" class="secondary" @click="openPlan">看当前餐次</button>
          </view>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import { pollApi, type MealPollDetail, type MealPollStatus } from "@/apis/poll";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { formatMealSlot } from "@/utils/meal-slot";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();
const loading = ref(false);
const errorText = ref("");
const pollId = ref<UUID | "">("");
const pollDetail = ref<MealPollDetail | null>(null);

const currentDiningGroupId = computed(() => diningGroupStore.currentDiningGroupId);
const currentDiningGroupName = computed(() => diningGroupStore.currentDiningGroup?.name ?? "当前饭搭子");
const rankedCandidates = computed(() =>
  (pollDetail.value?.candidates ?? [])
    .slice()
    .sort((left, right) => right.voteCount - left.voteCount)
    .map((item, index) => ({ ...item, rank: index + 1 }))
);
const noteList = computed(() =>
  (pollDetail.value?.responses ?? [])
    .filter(item => Boolean(item.note?.trim()))
    .map(item => ({ id: item.id, userUid: item.userUid, note: item.note?.trim() ?? "" }))
);
const noteCount = computed(() => noteList.value.length);
const suggestionCount = computed(() => (pollDetail.value?.candidates ?? []).filter(item => item.sourceType === "SUGGESTION").length);

onLoad(query => {
  const raw = Array.isArray(query?.pollId) ? query.pollId[0] : query?.pollId;
  const nextPollId = typeof raw === "string" ? Number.parseInt(decodeURIComponent(raw), 10) : NaN;
  pollId.value = Number.isFinite(nextPollId) && nextPollId > 0 ? nextPollId : "";
});

onShow(() => {
  void loadPage();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) clearPageState();
  }
);

async function loadPage(force = false) {
  if (!sessionStore.isLoggedIn) {
    clearPageState();
    return;
  }

  if (!currentDiningGroupId.value || force) {
    try {
      await diningGroupStore.refreshCurrent();
    } catch (error) {
      errorText.value = error instanceof Error ? error.message : "饭搭子加载失败";
    }
  }

  loading.value = true;
  errorText.value = "";
  try {
    let targetPollId = pollId.value;

    if (!targetPollId && currentDiningGroupId.value) {
      const items = await pollApi.list({ diningGroupId: currentDiningGroupId.value, limit: 1 });
      targetPollId = items[0]?.id ?? "";
      pollId.value = targetPollId;
    }

    if (!targetPollId) {
      pollDetail.value = null;
      return;
    }

    pollDetail.value = await pollApi.getDetail(targetPollId);
  } catch (error) {
    pollDetail.value = null;
    errorText.value = error instanceof Error ? error.message : "结果汇总加载失败";
  } finally {
    loading.value = false;
  }
}

function clearPageState() {
  pollDetail.value = null;
  errorText.value = "";
}

function formatStatus(status: MealPollStatus) {
  if (status === "OPEN") return "征集中";
  if (status === "CLOSED") return "已截止";
  if (status === "CONFIRMED") return "已确认";
  return "已完成";
}

function openPoll() {
  if (!pollId.value) return;
  void uniPlatform.navigation.navigateTo(`/pages_meal/poll/index?pollId=${encodeURIComponent(String(pollId.value))}`);
}

function openPlan() {
  void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
}

function openMemory(eventId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId))}`);
}
</script>

<style scoped lang="scss">
.notice,
.hero-card,
.summary-card,
.section-card {
  margin: var(--space-md) var(--space-page) 0;
  border-radius: var(--radius-lg);
}

.notice,
.hero-card,
.summary-card,
.section-card {
  padding: var(--space-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.empty-wrap {
  margin: var(--space-md) var(--space-page) 0;
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.notice__text,
.notice__action,
.hero-card__eyebrow,
.hero-card__title,
.hero-card__description,
.section-card__title {
  display: block;
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.hero-card {
  background:
    radial-gradient(circle at top right, rgba(255, 220, 156, 0.3), transparent 36%),
    linear-gradient(145deg, rgba(255, 247, 233, 0.98), rgba(255, 255, 255, 0.98));
}

.hero-card__eyebrow {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.hero-card__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.hero-card__description {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.summary-item {
  padding: 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.summary-item__label,
.summary-item__value,
.rank-row__title,
.rank-row__meta,
.note-row__title,
.note-row__text {
  display: block;
}

.summary-item__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.summary-item__value {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.section-card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.rank-list,
.note-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 22rpx;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.rank-row__rank {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.88);
}

.rank-row__rank-text,
.rank-row__votes {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.rank-row__main {
  min-width: 0;
  flex: 1;
}

.rank-row__title-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.rank-row__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.rank-row__badge {
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.75);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.rank-row__meta,
.note-row__title,
.note-row__text {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.note-row {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.note-row__title {
  margin-top: 0;
  color: var(--color-text-secondary);
}

.note-row__text {
  line-height: var(--line-height-normal);
}

.action-row {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-top: 22rpx;
}

.secondary {
  margin: 0;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
