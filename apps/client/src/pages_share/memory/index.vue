<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="饭搭子卡">
    <Login
      v-if="mode === 'event' && !sessionStore.isLoggedIn"
      title="登录后生成饭搭子卡"
      description="公开饭搭子卡先生成不可变快照，只保留菜单、掌勺标记、可选成员摘要和一句话。"
    />

    <template v-else>
      <view v-if="errorText" class="notice" @click="loadPage">
        <text class="notice__text">{{ errorText }}</text>
        <text class="notice__action">重新加载</text>
      </view>

      <view v-else-if="loading && !cardData" class="notice">
        <text class="notice__text">饭搭子卡加载中...</text>
      </view>

      <view v-else-if="!cardData" class="empty-wrap">
        <Empty title="还没有可展示的饭搭子卡" description="从已完成饭局生成一张公开快照，或通过公开分享链接查看不可变卡片。" />
      </view>

      <template v-else>
        <view class="memory-card">
          <text class="memory-card__eyebrow">{{ eyebrowText }}</text>
          <text class="memory-card__title">{{ cardData.title }}</text>
          <text v-if="primaryMeta" class="memory-card__meta">{{ primaryMeta }}</text>
          <text v-if="secondaryMeta" class="memory-card__meta">{{ secondaryMeta }}</text>

          <view class="memory-card__section">
            <text class="memory-card__section-title">这顿吃了什么</text>
            <view class="memory-menu">
              <view v-for="(item, index) in cardData.menuItems" :key="`${item.title}-${index}`" class="memory-menu__item">
                <view class="memory-menu__main">
                  <text class="memory-menu__name">{{ item.title }}</text>
                  <text class="memory-menu__cook">{{ resolveCookText(item.cookName) }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="memory-card__section">
            <text class="memory-card__section-title">一起吃饭的人</text>
            <view v-if="cardData.participants.length" class="participant-list">
              <view
                v-for="participant in cardData.participants"
                :key="`${participant.role}-${participant.displayName}`"
                class="participant-chip"
              >
                <text class="participant-chip__name">{{ participant.displayName }}</text>
                <text class="participant-chip__meta">{{ formatParticipantRole(participant.role) }}</text>
              </view>
            </view>
            <view v-else class="participant-placeholder">
              <text class="participant-placeholder__text">{{ participantHintText }}</text>
            </view>
          </view>

          <view v-if="cardData.caption" class="memory-card__section">
            <text class="memory-card__section-title">这一句</text>
            <view class="quote-card">
              <text class="quote-card__text">{{ cardData.caption }}</text>
            </view>
          </view>

          <view class="memory-card__footer">
            <text class="memory-card__hint">{{ footerHintText }}</text>
          </view>
        </view>

        <view v-if="currentSharePath" class="share-box">
          <view class="share-box__header">
            <text class="share-box__title">分享出口</text>
            <SharePillButton label="转发卡片" />
          </view>
          <text class="share-box__hint">点击“转发卡片”可直接发给饭搭子；也可以复制下面的公开路径作为兜底。</text>
          <text class="share-box__path">{{ currentSharePath }}</text>
          <view class="action-row">
            <button class="secondary" @click="copySharePath">复制公开路径</button>
            <button v-if="mode === 'event'" class="secondary" @click="openPublicPreview(currentSharePath)">查看公开预览</button>
          </view>
        </view>

        <view v-if="mode === 'event'" class="action-card">
          <text class="action-card__title">生成设置</text>

          <view class="setting-row">
            <view class="setting-row__main">
              <text class="setting-row__title">展示参与成员</text>
              <text class="setting-row__desc">只展示确认昵称与头像摘要，不带出投票、购物和冰箱信息。</text>
            </view>
            <switch :checked="showParticipants" color="#d66a1f" @change="handleParticipantsChange" />
          </view>

          <view class="field-block">
            <text class="field-block__title">留一句话</text>
            <textarea
              v-model="caption"
              class="textarea"
              maxlength="120"
              placeholder="例如：今天这一顿，终于把大家都约齐了。（可选）"
            />
          </view>

          <text class="action-card__hint">
            {{ eventDetail?.completedAt ? "只有当前白名单字段会进入公开快照，后续饭局改动不会回写到已生成卡片。" : "饭局完成后，主理人才能生成公开快照。" }}
          </text>

          <view class="action-row">
            <button class="primary" :disabled="!canGenerate" @click="createShare">
              {{ submitting ? "生成中..." : shareSnapshot ? "重新生成快照" : "生成分享快照" }}
            </button>
            <button class="secondary" @click="openPlan">回到当前餐次</button>
          </view>
        </view>
      </template>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onLoad, onShow, onShareAppMessage } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import type { UUID } from "@/apis/http";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import Login from "@/components/Login/Login.vue";
import SharePillButton from "@/components/Share/SharePillButton.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { uniPlatform } from "@/platform/uni";
import { mealApi, type DiningEventSummary } from "@/pages_meal/apis/meal";
import {
  shareApi,
  type MemoryShareParticipant,
  type MemorySharePreviewResponse,
  type MemoryShareSnapshotResponse
} from "@/pages_share/apis/share";
import { useSessionStore } from "@/stores/session";
import { createOperationId } from "@/utils/operation-id";

type PageMode = "empty" | "event" | "token";

interface MemoryCardView {
  title: string;
  planDate: string | null;
  mealSlot: "BREAKFAST" | "LUNCH" | "DINNER" | null;
  menuItems: Array<{
    title: string;
    coverUrl: string | null;
    cookName: string | null;
  }>;
  participants: MemoryShareParticipant[];
  caption: string | null;
  sharedAt: string | null;
  snapshotVersion: number | null;
}

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const mode = ref<PageMode>("empty");
const loading = ref(false);
const submitting = ref(false);
const errorText = ref("");
const eventId = ref<UUID | "">("");
const shareToken = ref("");
const showParticipants = ref(true);
const caption = ref("");
const eventDetail = ref<DiningEventSummary | null>(null);
const sharePreview = ref<MemoryCardView | null>(null);
const shareSnapshot = ref<MemoryShareSnapshotResponse | null>(null);

const normalizedCaption = computed(() => {
  const value = caption.value.trim();
  return value ? value : null;
});

const draftParticipantCount = computed(() => {
  if (!eventDetail.value) return 0;
  return 1 + eventDetail.value.participants.filter(item => item.status === "ACCEPTED").length;
});

const cardData = computed<MemoryCardView | null>(() => {
  if (shareSnapshot.value) return toCardView(shareSnapshot.value);
  if (sharePreview.value) return sharePreview.value;
  if (!eventDetail.value) return null;
  return buildDraftCard(eventDetail.value, normalizedCaption.value, showParticipants.value);
});

const eyebrowText = computed(() => {
  if (mode.value === "token") return "公开分享快照";
  if (shareSnapshot.value) return "最新不可变快照";
  return "生成前预览";
});

const primaryMeta = computed(() => {
  if (cardData.value?.planDate || cardData.value?.mealSlot) {
    const parts = [cardData.value.planDate, cardData.value.mealSlot ? formatMealSlot(cardData.value.mealSlot) : null].filter(Boolean);
    return parts.join(" · ");
  }

  if (!eventDetail.value) return "";
  const parts = [formatDateTime(eventDetail.value.scheduledAt), eventDetail.value.location];
  return parts.filter(Boolean).join(" · ");
});

const secondaryMeta = computed(() => {
  if (!cardData.value?.sharedAt || !cardData.value.snapshotVersion) return "";
  return `分享于 ${formatDateTime(cardData.value.sharedAt)} · 第 ${cardData.value.snapshotVersion} 版`;
});

const participantHintText = computed(() => {
  if (cardData.value?.participants.length) return "";
  if (mode.value === "event" && !shareSnapshot.value) {
    if (!showParticipants.value) return "这次生成不会展示参与成员。";
    if (!draftParticipantCount.value) return "生成后只展示已确认成员的昵称与头像摘要。";
    return `生成后会展示 ${draftParticipantCount.value} 位已确认成员的昵称与头像摘要。`;
  }
  return "这张卡没有公开参与成员摘要。";
});

const footerHintText = computed(() => {
  if (mode.value === "token") {
    return "这是一张不可变公开快照，后续饭局调整不会影响这里的展示。";
  }
  if (shareSnapshot.value) {
    return "已生成公开快照；如果你修改展示设置，需要重新生成一张新的快照版本。";
  }
  return "生成前预览只用于确认公开内容，正式分享时会冻结为不可变快照。";
});

const canGenerate = computed(() => Boolean(eventId.value && eventDetail.value?.completedAt) && !submitting.value);
const currentSharePath = computed(() => {
  if (shareSnapshot.value?.sharePath) return shareSnapshot.value.sharePath;
  if (mode.value === "token" && shareToken.value) {
    return `/pages_share/memory/index?token=${encodeURIComponent(shareToken.value)}`;
  }
  return "";
});
const shareTitle = computed(() => {
  if (!cardData.value) return "饭搭子卡";
  if (cardData.value.planDate && cardData.value.mealSlot) {
    return `${cardData.value.planDate} ${formatMealSlot(cardData.value.mealSlot)} · ${cardData.value.title}`;
  }
  return `${cardData.value.title} · 饭搭子卡`;
});
const shareImageUrl = computed(() => cardData.value?.menuItems.find(item => Boolean(item.coverUrl))?.coverUrl ?? undefined);

onLoad(query => {
  const rawToken = Array.isArray(query?.token) ? query.token[0] : query?.token;
  const nextToken = typeof rawToken === "string" ? decodeURIComponent(rawToken) : "";
  if (nextToken) {
    mode.value = "token";
    shareToken.value = nextToken;
    return;
  }

  const rawEventId = Array.isArray(query?.eventId) ? query.eventId[0] : query?.eventId;
  const nextEventId = typeof rawEventId === "string" ? Number.parseInt(decodeURIComponent(rawEventId), 10) : NaN;
  if (Number.isFinite(nextEventId) && nextEventId > 0) {
    mode.value = "event";
    eventId.value = nextEventId;
    return;
  }

  mode.value = "empty";
});

onShow(() => {
  void loadPage();
});

onShareAppMessage(() => ({
  title: shareTitle.value,
  path: currentSharePath.value || "/pages/home/index",
  imageUrl: shareImageUrl.value
}));

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (mode.value === "event" && !isLoggedIn) {
      eventDetail.value = null;
      shareSnapshot.value = null;
      errorText.value = "";
    }
  }
);

watch(showParticipants, () => {
  if (mode.value === "event" && shareSnapshot.value) {
    shareSnapshot.value = null;
  }
});

watch(normalizedCaption, () => {
  if (mode.value === "event" && shareSnapshot.value) {
    shareSnapshot.value = null;
  }
});

async function loadPage() {
  if (mode.value === "token") {
    if (!shareToken.value) {
      sharePreview.value = null;
      errorText.value = "";
      return;
    }

    loading.value = true;
    errorText.value = "";
    try {
      sharePreview.value = toCardView(await shareApi.getMemoryPreview(shareToken.value));
    } catch (error) {
      sharePreview.value = null;
      errorText.value = error instanceof Error ? error.message : "饭搭子卡加载失败";
    } finally {
      loading.value = false;
    }
    return;
  }

  if (mode.value !== "event") {
    sharePreview.value = null;
    eventDetail.value = null;
    errorText.value = "";
    return;
  }

  if (!sessionStore.isLoggedIn) {
    eventDetail.value = null;
    errorText.value = "";
    return;
  }

  if (!eventId.value) {
    eventDetail.value = null;
    errorText.value = "";
    return;
  }

  loading.value = true;
  errorText.value = "";
  try {
    eventDetail.value = await mealApi.getDiningEvent(eventId.value);
  } catch (error) {
    eventDetail.value = null;
    shareSnapshot.value = null;
    errorText.value = error instanceof Error ? error.message : "饭搭子卡加载失败";
  } finally {
    loading.value = false;
  }
}

async function createShare() {
  if (!eventId.value || !canGenerate.value || submitting.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    shareSnapshot.value = await shareApi.createMemoryShare(eventId.value, createOperationId(), showParticipants.value, normalizedCaption.value);
    await uniPlatform.feedback.toast({ title: "已生成饭搭子卡", icon: "success" });
  } catch (error) {
    shareSnapshot.value = null;
    errorText.value = error instanceof Error ? error.message : "饭搭子卡生成失败";
  } finally {
    submitting.value = false;
  }
}

async function copySharePath() {
  if (!currentSharePath.value) return;

  try {
    await uniPlatform.clipboard.set(currentSharePath.value);
  } catch {
    await uniPlatform.feedback.toast({ title: "复制失败", icon: "none" }).catch(() => undefined);
    return;
  }

  await uniPlatform.feedback.toast({ title: "已复制", icon: "success" }).catch(() => undefined);
}

function handleParticipantsChange(event: Event) {
  const detail = (event as Event & { detail?: { value?: boolean } }).detail;
  showParticipants.value = Boolean(detail?.value);
}

function openPlan() {
  void uniPlatform.navigation.navigateTo("/pages_meal/plan/index");
}

function openPublicPreview(path: string) {
  void uniPlatform.navigation.navigateTo(path);
}

function resolveCookText(cookName: string | null) {
  if (cookName) return `${cookName} 掌勺`;
  return "待认领";
}

function formatParticipantRole(role: MemoryShareParticipant["role"]) {
  if (role === "ORGANIZER") return "主理人";
  if (role === "PARTICIPANT") return "饭搭子";
  return "来客";
}

function formatMealSlot(value: "BREAKFAST" | "LUNCH" | "DINNER") {
  if (value === "BREAKFAST") return "早餐";
  if (value === "LUNCH") return "午餐";
  return "晚餐";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function toCardView(source: MemorySharePreviewResponse): MemoryCardView {
  return {
    title: source.title,
    planDate: source.planDate,
    mealSlot: source.mealSlot,
    menuItems: source.menuItems,
    participants: source.participants,
    caption: source.caption,
    sharedAt: source.sharedAt,
    snapshotVersion: source.snapshotVersion
  };
}

function buildDraftParticipants(event: DiningEventSummary, showMemberSummary: boolean): MemoryShareParticipant[] {
  if (!showMemberSummary) return [];

  const participants: MemoryShareParticipant[] = [
    {
      displayName: event.organizerName?.trim() || "主理人",
      avatarUrl: event.organizerAvatarUrl ?? null,
      role: "ORGANIZER"
    }
  ];

  for (const item of event.participants) {
    if (item.status !== "ACCEPTED") continue;

    if (item.sourceType === "SHARE" && item.guestName) {
      participants.push({
        displayName: item.guestName,
        avatarUrl: null,
        role: "GUEST"
      });
      continue;
    }

    participants.push({
      displayName: item.displayName?.trim() || "饭搭子",
      avatarUrl: item.avatarUrl ?? null,
      role: "PARTICIPANT"
    });
  }

  return participants;
}

function buildDraftCard(event: DiningEventSummary, nextCaption: string | null, showMemberSummary: boolean): MemoryCardView {
  return {
    title: event.title,
    planDate: null,
    mealSlot: null,
    menuItems: event.menuItems.map(item => ({
      title: item.title,
      coverUrl: null,
      cookName: item.cookName
    })),
    participants: buildDraftParticipants(event, showMemberSummary),
    caption: nextCaption,
    sharedAt: null,
    snapshotVersion: null
  };
}
</script>

<style scoped lang="scss">
.notice,
.memory-card,
.share-box,
.action-card {
  margin: var(--space-md) var(--space-page) 0;
  border-radius: var(--radius-lg);
}

.notice,
.memory-card,
.share-box,
.action-card {
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
.memory-card__eyebrow,
.memory-card__title,
.memory-card__meta,
.memory-card__section-title,
.memory-card__hint,
.action-card__title,
.action-card__hint,
.setting-row__title,
.setting-row__desc,
.field-block__title,
.share-box__title,
.share-box__hint,
.share-box__path,
.participant-placeholder__text,
.quote-card__text {
  display: block;
}

.notice__action {
  font-weight: var(--font-weight-heavy);
}

.memory-card {
  background:
    radial-gradient(circle at top right, rgba(255, 219, 145, 0.32), transparent 36%),
    linear-gradient(160deg, rgba(255, 248, 236, 0.98), rgba(255, 255, 255, 0.98));
}

.memory-card__eyebrow {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.memory-card__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 44rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.memory-card__meta,
.memory-card__hint,
.action-card__hint,
.setting-row__desc,
.participant-placeholder__text {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.memory-card__section,
.field-block {
  margin-top: 28rpx;
}

.memory-card__section-title,
.action-card__title,
.setting-row__title,
.field-block__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.memory-menu,
.participant-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 18rpx;
}

.memory-menu__item,
.participant-chip,
.participant-placeholder,
.quote-card {
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.8);
}

.memory-menu__name,
.memory-menu__cook,
.participant-chip__name,
.participant-chip__meta {
  display: block;
}

.memory-menu__name,
.participant-chip__name,
.quote-card__text {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.memory-menu__cook,
.participant-chip__meta {
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.memory-card__footer {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.share-box__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.share-box__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.share-box__hint {
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.share-box__path {
  margin-top: 16rpx;
  padding: 20rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  word-break: break-all;
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin-top: 18rpx;
}

.setting-row__main {
  flex: 1;
}

.textarea {
  width: 100%;
  min-height: 180rpx;
  margin-top: 16rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  box-sizing: border-box;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 18rpx;
}

.primary,
.secondary {
  margin: 0;
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
