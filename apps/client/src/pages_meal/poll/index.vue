<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="点菜征集" full-screen :navbar-placeholder="false" navbar-transparent>
    <view class="poll-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view class="poll-scroll" scroll-y :show-scrollbar="false" @scroll="handlePollScroll">
      <view class="poll-page">
        <view class="poll-hero" :style="heroStyle">
          <view class="hero-card">
            <text class="hero-card__eyebrow">{{ currentDiningGroupName }}</text>
            <text class="hero-card__title">这一顿，大家一起定</text>
            <text class="hero-card__description">{{ heroDescription }}</text>
          </view>

          <view v-if="sessionStore.isLoggedIn && currentDiningGroupId" class="status-card">
            <view class="status-grid">
              <view class="status-grid__item">
                <text class="status-grid__label">当前状态</text>
                <text class="status-grid__value">{{ currentStatusTitle }}</text>
              </view>
              <view class="status-grid__item">
                <text class="status-grid__label">已回应</text>
                <text class="status-grid__value">{{ responseSummaryText }}</text>
              </view>
              <view class="status-grid__item">
                <text class="status-grid__label">候选菜</text>
                <text class="status-grid__value">{{ candidateSummaryText }}</text>
              </view>
            </view>

            <view class="hero-action-row">
              <button class="primary hero-action-row__button" @click="handleHeroAction">{{ heroActionText }}</button>
              <button class="secondary hero-action-row__button" @click="openPlan">去计划页</button>
            </view>
          </view>
        </view>

        <view class="poll-content">
          <Login
            v-if="!sessionStore.isLoggedIn"
            title="登录后参与点菜征集"
            description="和饭搭子一起定下一顿，看看大家想吃什么。"
          />

          <template v-else>
            <view v-if="!currentDiningGroupId" class="empty-wrap">
              <Empty title="还没有饭搭子关系" description="先加入或创建饭搭子，再一起发起和参与点菜征集。" />
            </view>

            <template v-else>
              <view v-if="errorText" class="notice" @click="loadPage(true)">
                <text class="notice__text">{{ errorText }}</text>
                <text class="notice__action">重新加载</text>
              </view>

              <view v-if="loading && !pollItems.length" class="notice">
                <text class="notice__text">征集加载中...</text>
              </view>

              <view v-else-if="!pollItems.length" class="empty-wrap">
                <Empty title="当前还没有点菜征集" description="等主理人发起后，这里会展示当前饭搭子的征集摘要。" />
                <view class="empty-action-row">
                  <button class="secondary empty-action-row__button" @click="openPlan">先去看看计划</button>
                </view>
              </view>

              <view v-else class="poll-list">
                <view
                  v-for="item in pollItems"
                  :key="item.id"
                  class="poll-card"
                  :class="{ 'poll-card--active': item.id === activePollId }"
                  hover-class="poll-card--hover"
                  hover-stay-time="100"
                  @click="selectPoll(item.id)"
                >
                  <view class="poll-card__header">
                    <view>
                      <text class="poll-card__title">{{ item.title }}</text>
                      <text class="poll-card__meta">{{ item.planDate }} · {{ formatMealSlot(item.mealSlot) }} · {{ formatStatus(item.status) }}</text>
                    </view>
                    <text class="poll-card__deadline">{{ formatHourMinute(item.deadlineAt) }} 截止</text>
                  </view>

                  <view class="poll-card__stats">
                    <text class="poll-card__stat">候选 {{ item.candidateCount }}</text>
                    <text class="poll-card__stat">已回应 {{ item.responseCount }}</text>
                    <text class="poll-card__stat">每人最多 {{ item.choiceLimit }} 道</text>
                  </view>

                  <text v-if="item.note" class="poll-card__note">{{ item.note }}</text>
                </view>
              </view>

              <view v-if="detailLoading" class="notice">
                <text class="notice__text">征集详情加载中...</text>
              </view>

              <template v-else-if="currentPoll">
                <view class="detail-card">
                  <view class="detail-card__header">
                    <view>
                      <text class="detail-card__label">当前征集</text>
                      <text class="detail-card__title">{{ currentPoll.title }}</text>
                    </view>
                    <view class="detail-card__badge">
                      <text class="detail-card__badge-text">{{ formatStatus(currentPoll.status) }}</text>
                    </view>
                  </view>

                  <view class="detail-grid">
                    <view class="detail-grid__item">
                      <text class="detail-grid__label">截止时间</text>
                      <text class="detail-grid__value">{{ formatMonthDayMinute(currentPoll.deadlineAt) }}</text>
                    </view>
                    <view class="detail-grid__item">
                      <text class="detail-grid__label">已回应</text>
                      <text class="detail-grid__value">{{ currentPoll.responses.length }} 人</text>
                    </view>
                    <view class="detail-grid__item">
                      <text class="detail-grid__label">候选菜</text>
                      <text class="detail-grid__value">{{ currentPoll.candidates.length }} 道</text>
                    </view>
                  </view>

                  <text v-if="currentPoll.note" class="detail-card__note">备注：{{ currentPoll.note }}</text>

                  <view v-if="showResultEntry" class="detail-action">
                    <button class="secondary detail-action__button" @click="openResult(currentPoll.id)">查看结果汇总</button>
                    <button
                      v-if="currentPoll.confirmedDiningEventId"
                      class="secondary detail-action__button"
                      @click="openMemory(currentPoll.confirmedDiningEventId)"
                    >
                      查看饭搭子卡
                    </button>
                  </view>

                  <view class="candidate-list">
                    <view
                      v-for="candidate in currentPoll.candidates"
                      :key="candidate.id"
                      class="candidate-card"
                      :class="{
                        'candidate-card--selected': selectedCandidateIds.includes(candidate.id),
                        'candidate-card--disabled': candidate.status !== 'ACTIVE'
                      }"
                      hover-class="candidate-card--hover"
                      hover-stay-time="100"
                      @click="toggleCandidate(candidate.id)"
                    >
                      <view class="candidate-card__main">
                        <view class="candidate-card__name-line">
                          <text class="candidate-card__name">{{ candidate.title }}</text>
                          <text class="candidate-card__badge">{{ candidate.sourceType === "SUGGESTION" ? "建议菜" : "菜谱" }}</text>
                        </view>
                        <text class="candidate-card__meta">
                          {{ candidate.voteCount }} 票
                          <text v-if="candidate.status !== 'ACTIVE'"> · {{ candidate.status === "PENDING" ? "待确认" : "已拒绝" }}</text>
                        </text>
                      </view>
                      <text class="candidate-card__pick">{{ selectedCandidateIds.includes(candidate.id) ? "已选" : "选择" }}</text>
                    </view>
                  </view>

                  <view v-if="canVoteCurrentPoll" class="editor-card">
                    <text class="editor-card__title">我的回应</text>
                    <text class="editor-card__hint">当前只开放“至少选 1 道候选菜再提交”；补充建议会随本次投票一起提交。</text>
                    <input v-model="suggestionTitle" class="input" maxlength="20" placeholder="补充一道，例如：蒸蛋（可选）" />
                    <textarea v-model="responseNote" class="textarea" maxlength="50" placeholder="备注一句，比如：少辣一点（可选）" />
                    <view class="editor-card__footer">
                      <text class="editor-card__summary">已选 {{ selectedCandidateIds.length }}/{{ currentPoll.choiceLimit }} 道</text>
                      <button class="primary" :disabled="voteSubmitting || !canSubmitVote" @click="submitVote">提交选择</button>
                    </view>
                  </view>

                  <view v-if="canManageCurrentPoll" class="editor-card">
                    <text class="editor-card__title">主理人确认菜单</text>
                    <text class="editor-card__hint">只允许确认已经落到正式菜谱版本的候选菜；建议菜未落成版本前不能直接确认。</text>

                    <view class="confirm-list">
                      <view
                        v-for="candidate in confirmCandidates"
                        :key="candidate.id"
                        class="confirm-row"
                        :class="{ 'confirm-row--selected': finalCandidateIds.includes(candidate.id), 'confirm-row--disabled': !candidate.recipeVersionId }"
                        hover-class="confirm-row--hover"
                        hover-stay-time="100"
                        @click="toggleFinalCandidate(candidate.id)"
                      >
                        <view>
                          <text class="confirm-row__title">{{ candidate.title }}</text>
                          <text class="confirm-row__meta">
                            {{ candidate.voteCount }} 票
                            <text v-if="!candidate.recipeVersionId"> · 待落成正式菜谱</text>
                          </text>
                        </view>
                        <text class="confirm-row__pick">{{ finalCandidateIds.includes(candidate.id) ? "确认" : "待选" }}</text>
                      </view>
                    </view>

                    <input v-model="scheduledAt" class="input" placeholder="开饭时间，例如 2026-08-02T18:30:00.000Z（可选）" />
                    <input v-model="location" class="input" maxlength="20" placeholder="地点，例如 家里（可选）" />
                    <view class="editor-card__footer">
                      <text class="editor-card__summary">确认后会同步生成或更新当前餐次和饭局</text>
                      <button class="primary" :disabled="confirmSubmitting || !canSubmitConfirm" @click="submitConfirm">确认菜单</button>
                    </view>
                  </view>
                </view>
              </template>
            </template>
          </template>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import { ApiClientError, type UUID } from "@/apis/http";
import { pollApi, type MealPollCandidateSummary, type MealPollDetail, type MealPollStatus, type MealPollSummary } from "@/apis/poll";
import Login from "@/components/Login/Login.vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { useDiningGroupStore } from "@/stores/dining-group";
import { useSessionStore } from "@/stores/session";
import { formatHourMinute, formatMonthDayMinute } from "../utils/date";
import { createOperationId } from "@/utils/operation-id";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const diningGroupStore = useDiningGroupStore();

const POLL_NAV_GAP = 16;
const POLL_NAV_FADE_DISTANCE = 96;

const loading = ref(false);
const detailLoading = ref(false);
const voteSubmitting = ref(false);
const confirmSubmitting = ref(false);
const errorText = ref("");
const pollItems = ref<MealPollSummary[]>([]);
const pollMap = ref<Record<string, MealPollDetail>>({});
const activePollId = ref<UUID | "">("");
const selectedCandidateIds = ref<UUID[]>([]);
const suggestionTitle = ref("");
const responseNote = ref("");
const finalCandidateIds = ref<UUID[]>([]);
const scheduledAt = ref("");
const location = ref("");
const initialPollId = ref<UUID | "">("");
const voteOperationId = ref("");
const confirmOperationId = ref("");
const pollScrollTop = ref(0);
let listPromise: Promise<void> | null = null;
let detailSeq = 0;

const currentDiningGroupId = computed(() => diningGroupStore.currentDiningGroupId);
const currentDiningGroupName = computed(() => diningGroupStore.currentDiningGroup?.name ?? "当前饭搭子");
const currentPoll = computed(() => (activePollId.value ? pollMap.value[String(activePollId.value)] ?? null : null));
const summaryPoll = computed(() => currentPoll.value ?? pollItems.value[0] ?? null);
const canManageCurrentPoll = computed(() => {
  const role = diningGroupStore.currentDiningGroup?.myRole;
  return currentPoll.value?.status === "OPEN" && (role === "OWNER" || role === "ADMIN");
});
const canVoteCurrentPoll = computed(() => currentPoll.value?.status === "OPEN");
const canSubmitVote = computed(() => {
  const poll = currentPoll.value;
  if (!poll || !canVoteCurrentPoll.value) return false;
  return selectedCandidateIds.value.length > 0 && selectedCandidateIds.value.length <= poll.choiceLimit;
});
const confirmCandidates = computed(() =>
  [...(currentPoll.value?.candidates ?? [])].filter(item => item.status === "ACTIVE").sort((left, right) => right.voteCount - left.voteCount)
);
const canSubmitConfirm = computed(() => {
  if (!canManageCurrentPoll.value || !currentPoll.value) return false;
  return finalCandidateIds.value.length > 0 && resolveFinalRecipeVersionIds().length > 0;
});
const showResultEntry = computed(() => {
  if (!currentPoll.value) return false;
  return currentPoll.value.status !== "OPEN" || Boolean(currentPoll.value.confirmedPlanItemId || currentPoll.value.confirmedDiningEventId);
});
const currentStatusTitle = computed(() => {
  if (!summaryPoll.value) return "还没有征集";
  return formatStatus(summaryPoll.value.status);
});
const responseSummaryText = computed(() => {
  if (!summaryPoll.value) return "等主理人发起";
  const memberCount = diningGroupStore.currentDiningGroup?.memberCount ?? 0;
  if (!memberCount) return `${summaryPoll.value.responseCount} 人已回应`;
  const pendingCount = Math.max(memberCount - summaryPoll.value.responseCount, 0);
  return pendingCount > 0 ? `还差 ${pendingCount} 人` : `${summaryPoll.value.responseCount}/${memberCount} 人`;
});
const candidateSummaryText = computed(() => (summaryPoll.value ? `${summaryPoll.value.candidateCount} 道` : "等征集开始"));
const heroDescription = computed(() => {
  if (!summaryPoll.value) {
    return "先看今晚有没有正在协商的征集；如果还没开始，就先去计划页把这顿饭定个方向。";
  }

  return `${formatMealSlot(summaryPoll.value.mealSlot)} · ${formatHourMinute(summaryPoll.value.deadlineAt)} 截止 · ${responseSummaryText.value}`;
});
const heroActionText = computed(() => (summaryPoll.value ? "查看当前征集" : "去看看计划"));
const navProgress = computed(() => Math.min(1, Math.max(0, pollScrollTop.value / POLL_NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + POLL_NAV_GAP}px`
}));

onLoad(query => {
  const raw = Array.isArray(query?.pollId) ? query.pollId[0] : query?.pollId;
  const nextPollId = typeof raw === "string" ? Number.parseInt(decodeURIComponent(raw), 10) : NaN;
  initialPollId.value = Number.isFinite(nextPollId) && nextPollId > 0 ? nextPollId : "";
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

watch(
  () => currentDiningGroupId.value,
  (nextId, prevId) => {
    if (nextId === prevId) return;
    clearPageState();
    if (sessionStore.isLoggedIn && nextId) {
      void loadPage(true);
    }
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

  if (!currentDiningGroupId.value) {
    clearPageState();
    return;
  }

  if (listPromise) {
    await listPromise;
    return;
  }

  loading.value = true;
  errorText.value = "";
  const requestGroupId = currentDiningGroupId.value;
  listPromise = pollApi
    .list({ diningGroupId: requestGroupId, limit: 10 })
    .then(async items => {
      if (currentDiningGroupId.value !== requestGroupId) return;

      pollItems.value = items;
      const nextActiveId = resolveInitialPollId(items);
      activePollId.value = nextActiveId;
      if (nextActiveId) {
        await loadDetail(nextActiveId, { force });
      }
    })
    .catch(error => {
      if (currentDiningGroupId.value !== requestGroupId) return;
      errorText.value = error instanceof Error ? error.message : "征集加载失败";
      pollItems.value = [];
    })
    .finally(() => {
      loading.value = false;
      listPromise = null;
    });

  await listPromise;
}

async function selectPoll(pollId: UUID) {
  activePollId.value = pollId;
  await loadDetail(pollId);
}

async function loadDetail(pollId: UUID, options: { force?: boolean } = {}) {
  if (!sessionStore.isLoggedIn) return;
  if (!options.force && pollMap.value[String(pollId)]) {
    applyDetailState(pollMap.value[String(pollId)]);
    return;
  }

  detailLoading.value = true;
  const seq = ++detailSeq;
  try {
    const detail = await pollApi.getDetail(pollId);
    if (seq !== detailSeq || activePollId.value !== pollId) return;
    pollMap.value = { ...pollMap.value, [String(detail.id)]: detail };
    applyDetailState(detail);
  } catch (error) {
    if (seq !== detailSeq) return;
    errorText.value = error instanceof Error ? error.message : "征集详情加载失败";
  } finally {
    if (seq === detailSeq) detailLoading.value = false;
  }
}

function applyDetailState(detail: MealPollDetail) {
  const myResponse = detail.responses.find(item => item.userUid === sessionStore.uid) ?? null;
  const activeCandidateIds = new Set(detail.candidates.filter(item => item.status === "ACTIVE").map(item => item.id));
  selectedCandidateIds.value = [...(myResponse?.selectedCandidateIds ?? [])].filter(item => activeCandidateIds.has(item));
  suggestionTitle.value = myResponse?.suggestionCandidateId
    ? detail.candidates.find(item => item.id === myResponse.suggestionCandidateId)?.title ?? ""
    : "";
  responseNote.value = myResponse?.note ?? "";
  finalCandidateIds.value = detail.candidates
    .filter(item => item.status === "ACTIVE" && item.recipeVersionId)
    .sort((left, right) => right.voteCount - left.voteCount)
    .slice(0, Math.max(1, Math.min(detail.choiceLimit, 3)))
    .map(item => item.id);
  scheduledAt.value = "";
  location.value = "";
}

function resolveInitialPollId(items: MealPollSummary[]) {
  if (initialPollId.value && items.some(item => item.id === initialPollId.value)) {
    return initialPollId.value;
  }

  return items[0]?.id ?? "";
}

function clearPageState() {
  pollItems.value = [];
  pollMap.value = {};
  activePollId.value = "";
  selectedCandidateIds.value = [];
  suggestionTitle.value = "";
  responseNote.value = "";
  finalCandidateIds.value = [];
  scheduledAt.value = "";
  location.value = "";
  errorText.value = "";
  loading.value = false;
  detailLoading.value = false;
  voteSubmitting.value = false;
  confirmSubmitting.value = false;
}

function toggleCandidate(candidateId: UUID) {
  const poll = currentPoll.value;
  if (!poll || !canVoteCurrentPoll.value) return;
  const candidate = poll.candidates.find(item => item.id === candidateId);
  if (!candidate || candidate.status !== "ACTIVE") return;

  if (selectedCandidateIds.value.includes(candidateId)) {
    selectedCandidateIds.value = selectedCandidateIds.value.filter(item => item !== candidateId);
    return;
  }

  if (selectedCandidateIds.value.length >= poll.choiceLimit) {
    void uniPlatform.feedback.toast({ title: `最多选择 ${poll.choiceLimit} 道`, icon: "none" });
    return;
  }

  selectedCandidateIds.value = [...selectedCandidateIds.value, candidateId];
}

async function submitVote() {
  const poll = currentPoll.value;
  if (!poll || !canSubmitVote.value || voteSubmitting.value) return;

  voteSubmitting.value = true;
  errorText.value = "";
  voteOperationId.value ||= createOperationId();

  try {
    const detail = await pollApi.vote(poll.id, {
      operationId: voteOperationId.value,
      expectedVersion: poll.version,
      selectedCandidateIds: selectedCandidateIds.value,
      suggestionTitle: suggestionTitle.value.trim() || null,
      note: responseNote.value.trim() || null
    });

    replacePoll(detail);
    applyDetailState(detail);
    await uniPlatform.feedback.toast({ title: "已提交选择", icon: "success" });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 409) {
      await handleConflict(poll.id, "当前征集已更新，已帮你刷新");
    } else {
      errorText.value = error instanceof Error ? error.message : "提交失败";
      await uniPlatform.feedback.toast({ title: errorText.value, icon: "none" });
    }
  } finally {
    voteSubmitting.value = false;
    voteOperationId.value = "";
  }
}

function toggleFinalCandidate(candidateId: UUID) {
  const candidate = confirmCandidates.value.find(item => item.id === candidateId);
  if (!candidate?.recipeVersionId) return;

  if (finalCandidateIds.value.includes(candidateId)) {
    finalCandidateIds.value = finalCandidateIds.value.filter(item => item !== candidateId);
    return;
  }

  finalCandidateIds.value = [...finalCandidateIds.value, candidateId];
}

async function submitConfirm() {
  const poll = currentPoll.value;
  if (!poll || !canSubmitConfirm.value || confirmSubmitting.value) return;

  confirmSubmitting.value = true;
  errorText.value = "";
  confirmOperationId.value ||= createOperationId();

  try {
    const detail = await pollApi.confirm(poll.id, {
      operationId: confirmOperationId.value,
      expectedVersion: poll.version,
      finalRecipeVersionIds: resolveFinalRecipeVersionIds(),
      scheduledAt: scheduledAt.value.trim() || null,
      location: location.value.trim() || null
    });

    replacePoll(detail);
    applyDetailState(detail);
    await uniPlatform.feedback.toast({ title: "菜单已确认", icon: "success" });
    openResult(detail.id);
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 409) {
      await handleConflict(poll.id, "征集状态已变化，已帮你刷新");
    } else {
      errorText.value = error instanceof Error ? error.message : "确认失败";
      await uniPlatform.feedback.toast({ title: errorText.value, icon: "none" });
    }
  } finally {
    confirmSubmitting.value = false;
    confirmOperationId.value = "";
  }
}

async function handleConflict(pollId: UUID, message: string) {
  await loadDetail(pollId, { force: true });
  await loadPage(true);
  await uniPlatform.feedback.toast({ title: message, icon: "none" });
}

function replacePoll(detail: MealPollDetail) {
  pollMap.value = { ...pollMap.value, [String(detail.id)]: detail };
  pollItems.value = pollItems.value.map(item =>
    item.id === detail.id
      ? {
          id: detail.id,
          diningGroupId: detail.diningGroupId,
          title: detail.title,
          planDate: detail.planDate,
          mealSlot: detail.mealSlot,
          status: detail.status,
          deadlineAt: detail.deadlineAt,
          choiceLimit: detail.choiceLimit,
          note: detail.note,
          candidateCount: detail.candidateCount,
          responseCount: detail.responseCount,
          confirmedPlanItemId: detail.confirmedPlanItemId,
          confirmedDiningEventId: detail.confirmedDiningEventId,
          version: detail.version,
          createdAt: detail.createdAt
        }
      : item
  );
}

function resolveFinalRecipeVersionIds() {
  const detail = currentPoll.value;
  if (!detail) return [];

  return finalCandidateIds.value
    .map(candidateId => detail.candidates.find(item => item.id === candidateId)?.recipeVersionId ?? null)
    .filter((item): item is UUID => typeof item === "number" && item > 0);
}

function formatMealSlot(slot: MealPollSummary["mealSlot"]) {
  if (slot === "BREAKFAST") return "早餐";
  if (slot === "LUNCH") return "午餐";
  return "晚餐";
}

function formatStatus(status: MealPollStatus) {
  if (status === "OPEN") return "征集中";
  if (status === "CLOSED") return "已截止";
  if (status === "CONFIRMED") return "已确认";
  return "已完成";
}

function openResult(targetPollId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_meal/result/index?pollId=${encodeURIComponent(String(targetPollId))}`);
}

function openMemory(eventId: UUID) {
  void uniPlatform.navigation.navigateTo(`/pages_share/memory/index?eventId=${encodeURIComponent(String(eventId))}`);
}

function handleHeroAction() {
  if (summaryPoll.value) {
    void selectPoll(summaryPoll.value.id);
    return;
  }

  openPlan();
}

function openPlan() {
  void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
}

function handlePollScroll(event: { detail?: { scrollTop?: number } }) {
  pollScrollTop.value = event.detail?.scrollTop ?? 0;
}
</script>

<style scoped lang="scss">
.poll-nav-backdrop {
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

.poll-scroll {
  height: 100%;
  background: var(--color-page);
}

.poll-page {
  min-height: 100%;
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
}

.poll-hero {
  padding: 0 var(--space-page) 152rpx;
  background:
    linear-gradient(180deg, var(--color-surface-mask-weak), var(--color-surface-mask-medium)),
    radial-gradient(circle at 18% 26%, rgba(255, 220, 168, 0.46), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(182, 224, 190, 0.34), transparent 28%),
    linear-gradient(145deg, rgba(255, 246, 230, 0.96), rgba(252, 249, 242, 0.98));
}

.poll-content {
  position: relative;
  z-index: 1;
  margin-top: -96rpx;
  padding: 0 var(--space-page);
}

.hero-card,
.status-card,
.notice,
.poll-card,
.detail-card,
.editor-card {
  border-radius: var(--radius-lg);
}

.hero-card,
.status-card,
.poll-card,
.detail-card,
.editor-card {
  padding: var(--space-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.poll-hero .hero-card,
.poll-hero .status-card {
  margin-top: 0;
}

.poll-hero .status-card {
  margin-top: var(--space-md);
}

.empty-wrap {
  margin-top: var(--space-md);
}

.hero-card {
  background:
    radial-gradient(circle at top right, rgba(255, 218, 148, 0.28), transparent 38%),
    linear-gradient(145deg, rgba(255, 247, 233, 0.98), rgba(255, 255, 255, 0.98));
}

.hero-card__eyebrow,
.hero-card__title,
.hero-card__description {
  display: block;
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
  margin-top: 14rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.status-card,
.notice,
.poll-card,
.detail-card,
.editor-card,
.empty-action-row {
  margin-top: var(--space-sm);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  background: rgba(255, 243, 219, 0.96);
  color: #8b4d12;
}

.notice__text,
.notice__action {
  display: block;
  font-size: var(--font-size-sm);
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.poll-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.poll-card {
  transition: transform 0.18s ease;
}

.poll-card--hover {
  transform: translateY(-4rpx);
}

.poll-card--active {
  border: 2rpx solid rgba(233, 140, 57, 0.3);
  background: linear-gradient(145deg, rgba(255, 249, 241, 0.98), rgba(255, 255, 255, 0.98));
}

.poll-card__header,
.detail-card__header,
.editor-card__footer,
.candidate-card,
.confirm-row,
.poll-card__stats,
.detail-grid,
.status-grid,
.hero-action-row {
  display: flex;
}

.poll-card__header,
.detail-card__header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.poll-card__title,
.poll-card__meta,
.poll-card__deadline,
.poll-card__note,
.detail-card__label,
.detail-card__title,
.detail-card__note {
  display: block;
}

.poll-card__title,
.detail-card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.poll-card__meta,
.poll-card__deadline,
.poll-card__note,
.detail-card__label,
.detail-card__note,
.candidate-card__meta,
.editor-card__hint,
.confirm-row__meta {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.poll-card__meta,
.poll-card__note,
.detail-card__note {
  margin-top: 10rpx;
}

.poll-card__stats {
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 18rpx;
}

.poll-card__stat {
  padding: 10rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.status-grid {
  gap: 16rpx;
}

.status-grid__item {
  flex: 1;
  min-width: 0;
  padding: 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.status-grid__label,
.status-grid__value {
  display: block;
}

.status-grid__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.status-grid__value {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero-action-row {
  gap: 16rpx;
  margin-top: 20rpx;
}

.hero-action-row__button,
.empty-action-row__button {
  flex: 1;
  margin: 0;
}

.empty-action-row {
  margin-top: var(--space-md);
}

.detail-card__label {
  color: var(--color-primary);
  font-weight: var(--font-weight-heavy);
}

.detail-card__badge {
  flex: 0 0 auto;
  padding: 12rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
}

.detail-card__badge-text {
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.detail-grid {
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 24rpx;
}

.detail-grid__item {
  min-width: 180rpx;
  padding: 18rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.detail-grid__label,
.detail-grid__value {
  display: block;
}

.detail-grid__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.detail-grid__value {
  margin-top: 8rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.candidate-list,
.confirm-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.detail-action {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-top: 20rpx;
}

.detail-action__button {
  margin: 0;
}

.candidate-card,
.confirm-row {
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.candidate-card--selected,
.confirm-row--selected {
  background: rgba(255, 236, 205, 0.78);
}

.candidate-card--disabled,
.confirm-row--disabled {
  opacity: 0.55;
}

.candidate-card__main,
.confirm-row > view {
  min-width: 0;
}

.candidate-card__name-line {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.candidate-card__name,
.confirm-row__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.candidate-card__badge {
  padding: 6rpx 12rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.75);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}

.candidate-card__pick,
.confirm-row__pick {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.editor-card__title,
.editor-card__hint,
.editor-card__summary {
  display: block;
}

.editor-card__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.editor-card__hint {
  margin-top: 10rpx;
  line-height: var(--line-height-normal);
}

.input,
.textarea {
  width: 100%;
  margin-top: 18rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.textarea {
  min-height: 176rpx;
}

.editor-card__footer {
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 20rpx;
}

.editor-card__summary {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.primary {
  flex: 0 0 auto;
  margin: 0;
  padding: 0 32rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}
</style>
