<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="饭局邀请">
    <view v-if="loading && !preview" class="preview-shell">
      <view class="invite-card invite-skeleton">
        <view class="invite-card__section invite-card__host">
          <view class="skeleton-block skeleton-block--avatar" />
          <view class="invite-card__host-main">
            <view class="skeleton-block skeleton-block--host" />
          </view>
        </view>
        <view class="invite-card__divider" />
        <view class="invite-card__section invite-card__content">
          <view class="skeleton-block skeleton-block--title" />
          <view class="invite-card__time">
            <view class="skeleton-block skeleton-block--label" />
            <view class="skeleton-block skeleton-block--time" />
          </view>
        </view>
        <view class="invite-card__divider" />
        <view class="invite-card__section">
          <view class="skeleton-block skeleton-block--label" />
          <view class="participant-strip">
            <view class="skeleton-block skeleton-block--participant" />
            <view class="skeleton-block skeleton-block--participant" />
            <view class="skeleton-block skeleton-block--participant" />
          </view>
        </view>
        <view class="invite-card__divider" />
        <view class="invite-card__section">
          <view class="skeleton-block skeleton-block--label" />
          <view class="menu-list">
            <view class="skeleton-block skeleton-block--menu" />
            <view class="skeleton-block skeleton-block--menu" />
            <view class="skeleton-block skeleton-block--menu skeleton-block--menu-short" />
          </view>
        </view>
      </view>
    </view>
    <view v-else-if="errorText && !preview" class="notice" @click="loadPreview">{{ errorText }}</view>
    <Empty v-else-if="!preview" title="分享已失效" description="请让发起人重新生成一条新的饭局邀请。" />

    <template v-else>
      <view class="preview-shell">
        <view class="invite-card">
          <view class="invite-card__section invite-card__host">
            <view class="avatar">
              <image v-if="preview.organizerAvatarUrl" class="avatar__image" :src="preview.organizerAvatarUrl" mode="aspectFill" />
              <text v-else class="avatar__fallback">{{ organizerFallback }}</text>
            </view>
            <view class="invite-card__host-main">
              <view class="invite-card__host-line">
                <text v-if="preview.organizerName" class="invite-card__host-name">{{ preview.organizerName }}</text>
                <text class="invite-card__host-suffix">邀请你来吃饭</text>
              </view>
            </view>
          </view>

          <view class="invite-card__divider" />

          <view class="invite-card__section invite-card__content">
            <view v-if="preview.coverImageUrl" class="invite-card__cover">
              <image class="invite-card__cover-image" :src="preview.coverImageUrl" mode="aspectFill" />
            </view>
            <text class="invite-card__title">{{ preview.title }}</text>
            <view class="invite-card__time">
              <text class="invite-card__label">开饭时间</text>
              <text class="invite-card__time-value">{{ scheduleText }}</text>
            </view>
          </view>

          <template v-if="participantItems.length">
            <view class="invite-card__divider" />
            <view class="invite-card__section">
              <text class="invite-card__section-title">参与人</text>
              <view class="participant-strip">
                <view v-for="(item, index) in participantItems" :key="`${item.displayName || item.avatarUrl || 'participant'}-${index}`" class="participant-strip__item">
                  <view class="avatar avatar--participant">
                    <image v-if="item.avatarUrl" class="avatar__image" :src="item.avatarUrl" mode="aspectFill" />
                    <text v-else class="avatar__fallback">{{ buildAvatarFallback(item.displayName || "饭") }}</text>
                  </view>
                </view>
              </view>
            </view>
          </template>

          <view class="invite-card__divider" />

          <view class="invite-card__section">
            <text class="invite-card__section-title">菜单</text>
            <view v-if="menuItems.length" class="menu-list">
              <view
                v-for="item in menuItems"
                :key="`${item.title}-${item.recipeId || 'none'}`"
                class="menu-list__row"
                :class="{ 'menu-list__row--link': Boolean(item.recipeId) }"
                @click="openRecipeDetail(item.recipeId, item.recipeKind)"
              >
                <text class="menu-list__name">{{ item.title }}</text>
                <text v-if="item.recipeId" class="menu-list__action">查看</text>
              </view>
            </view>
            <text v-else class="menu-list__empty">菜单还在准备，加入后可以继续补和调整。</text>
          </view>

          <view class="invite-card__divider" />
          <view class="invite-footer">
            <view class="invite-footer__panel">
              <template v-if="sessionStore.isLoggedIn">
                <view class="invite-footer__guest">
                  <view class="invite-footer__guest-main">
                    <text class="invite-card__label">被邀请人</text>
                    <view class="invite-footer__guest-row">
                      <text class="invite-footer__guest-name">{{ guestDisplayName }}</text>
                    </view>
                  </view>
                </view>
              </template>

              <view v-if="showCountdownBar" class="invite-footer__countdown">
                <text class="meal-footer__countdown-prefix">还剩</text>
                <text class="meal-footer__countdown-box">{{ countdownParts.days }}</text>
                <text class="meal-footer__countdown-unit">天</text>
                <text class="meal-footer__countdown-box">{{ countdownParts.hours }}</text>
                <text class="meal-footer__countdown-separator">:</text>
                <text class="meal-footer__countdown-box">{{ countdownParts.minutes }}</text>
                <text class="meal-footer__countdown-separator">:</text>
                <text class="meal-footer__countdown-box">{{ countdownParts.seconds }}</text>
                <text class="meal-footer__countdown-suffix">开饭</text>
              </view>
              <view v-else-if="countdownLabel" class="invite-footer__hint">
                <text class="invite-footer__hint-text">{{ countdownLabel }}</text>
              </view>

              <button
                class="invite-footer__button"
                :class="{ 'invite-footer__button--secondary': primaryActionState.secondary }"
                :disabled="primaryActionDisabled"
                @click="handlePrimaryAction"
              >
                {{ primaryActionLabel }}
              </button>
              <text v-if="statusHint" class="invite-footer__status">{{ statusHint }}</text>
              <text v-if="errorText" class="invite-footer__error">{{ errorText }}</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </Layout>
</template>

<script setup lang="ts">
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, ref, watch } from "vue";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useLoginModalStore } from "@/stores/login-modal";
import { shareApi, type SharePreviewResponse, type SharePreviewViewerResponse } from "../apis/share";
import { resolveShareGuestName } from "../display-name";
import { resolveSharePreviewActionState } from "./action-state";
import { uniPlatform } from "@/platform/uni";
import { createOperationId } from "@/utils/operation-id";
import { useSessionStore } from "@/stores/session";
import { useUserStore } from "@/stores/user";
import { formatDateTimeMinute } from "../utils/date";
import type { UUID } from "@/apis/http";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const sessionStore = useSessionStore();
const userStore = useUserStore();
const loginModalStore = useLoginModalStore();

const shareToken = ref("");
const preview = ref<SharePreviewResponse | null>(null);
const viewer = ref<SharePreviewViewerResponse | null>(null);
const loading = ref(false);
const viewerLoading = ref(false);
const viewerFailed = ref(false);
const submitting = ref(false);
const errorText = ref("");
const nowMs = ref(Date.now());
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const organizerFallback = computed(() => buildAvatarFallback(preview.value?.organizerName || "友"));
const guestDisplayName = computed(() => resolveShareGuestName(sessionStore.user, sessionStore.uid));
const participantItems = computed(() => preview.value?.participants ?? []);
const menuItems = computed(() => preview.value?.menuPreview ?? []);

const scheduleText = computed(() => {
  if (!preview.value) return "";
  return formatInviteDateTime(preview.value.scheduledAt) || preview.value.scheduledAt;
});

const countdownMs = computed(() => {
  if (!preview.value) return null;
  const target = new Date(preview.value.scheduledAt).getTime();
  if (!Number.isFinite(target)) return null;
  return target - nowMs.value;
});

const showCountdownBar = computed(() => {
  if (countdownMs.value == null) return false;
  return countdownMs.value > 0 && countdownMs.value <= 24 * 60 * 60 * 1000;
});

const countdownParts = computed(() => {
  const remaining = Math.max(0, countdownMs.value ?? 0);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days: padCountdown(days),
    hours: padCountdown(hours),
    minutes: padCountdown(minutes),
    seconds: padCountdown(seconds)
  };
});

const countdownLabel = computed(() => {
  if (!preview.value) return "";
  if (showCountdownBar.value) return "";
  if (countdownMs.value != null && countdownMs.value <= 0) return "饭局已开始，尽快确认";
  return "";
});

const primaryActionState = computed(() =>
  resolveSharePreviewActionState({
    isLoggedIn: sessionStore.isLoggedIn,
    viewer: viewer.value,
    viewerLoading: viewerLoading.value,
    viewerFailed: viewerFailed.value,
    submitting: submitting.value
  })
);

const viewerAction = computed(() => primaryActionState.value.action);
const primaryActionLabel = computed(() => primaryActionState.value.label);
const primaryActionDisabled = computed(() => primaryActionState.value.disabled);

const statusHint = computed(() => {
  if (!sessionStore.isLoggedIn) return "登录后查看饭局详情，并按你的权限继续操作。";
  if (viewerFailed.value) return "权限加载失败，请重试。";
  return viewer.value?.statusHint ?? "";
});

onLoad(query => {
  const raw = Array.isArray(query?.token) ? query.token[0] : query?.token;
  shareToken.value = typeof raw === "string" ? decodeURIComponent(raw) : "";
  if (shareToken.value) {
    void loadPreview();
  } else {
    errorText.value = "分享链接无效";
  }
});

onShow(() => {
  startCountdownClock();
});

onHide(() => {
  stopCountdownClock();
});

onUnload(() => {
  stopCountdownClock();
});

watch(
  () => sessionStore.isLoggedIn,
  isLoggedIn => {
    if (!isLoggedIn) {
      viewer.value = null;
      viewerLoading.value = false;
      viewerFailed.value = false;
      return;
    }
    if (!shareToken.value || !preview.value) return;
    void loadViewer();
  }
);

async function loadPreview() {
  if (!shareToken.value || loading.value) return;
  loading.value = true;
  errorText.value = "";
  try {
    const result = await shareApi.getPreview(shareToken.value);
    preview.value = {
      ...result,
      organizerText: result.organizerText,
      organizerName: result.organizerName,
      organizerAvatarUrl: result.organizerAvatarUrl ?? null,
      inviteStatus: result.inviteStatus ?? "ACTIVE",
      participants: Array.isArray(result.participants) ? result.participants : [],
      menuPreview: result.menuPreview
    };
    if (sessionStore.isLoggedIn) {
      await loadViewer();
    } else {
      viewer.value = null;
      viewerFailed.value = false;
    }
  } catch (error) {
    preview.value = null;
    viewer.value = null;
    viewerFailed.value = false;
    errorText.value = error instanceof Error ? error.message : "分享加载失败";
  } finally {
    loading.value = false;
  }
}

async function loadViewer() {
  if (!shareToken.value || !sessionStore.isLoggedIn || viewerLoading.value) return;
  viewerLoading.value = true;
  viewerFailed.value = false;
  errorText.value = "";
  try {
    viewer.value = await shareApi.getPreviewViewer(shareToken.value);
  } catch (error) {
    viewer.value = null;
    viewerFailed.value = true;
    errorText.value = error instanceof Error ? error.message : "权限加载失败";
  } finally {
    viewerLoading.value = false;
  }
}

async function handlePrimaryAction() {
  if (!preview.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin();
    return;
  }
  if (viewerAction.value === "VIEW") {
    void openInvite();
    return;
  }
  if (viewerAction.value === "RETRY" || viewerAction.value === "PENDING") {
    await loadViewer();
    return;
  }
  if (viewerAction.value === "BLOCKED") {
    if (statusHint.value) {
      await uniPlatform.feedback.toast({ title: statusHint.value, icon: "none" });
    }
    return;
  }
  await acceptInvite();
}

async function acceptInvite() {
  if (!shareToken.value || submitting.value || !preview.value) return;
  submitting.value = true;
  errorText.value = "";
  try {
    const result = await shareApi.acceptInvite(shareToken.value, createOperationId(), guestDisplayName.value);
    await uniPlatform.feedback.toast({ title: "已加入饭局", icon: "success" });
    preview.value = { ...preview.value, inviteStatus: "ACCEPTED" };
    viewer.value = {
      action: "VIEW",
      statusHint: "你已经加入这场饭局了。"
    };
    void uniPlatform.navigation.redirectTo(resolveEventPath(result.id, result.planItemId));
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加入失败";
  } finally {
    submitting.value = false;
  }
}

function openLogin() {
  loginModalStore.open(null, () => {
    void loadPreview();
  });
}

function openInvite() {
  if (!preview.value) return;
  void uniPlatform.navigation.redirectTo(resolveEventPath(preview.value.eventId, preview.value.planItemId));
}

function resolveEventPath(eventId: UUID | "" | number | string, planItemId: UUID | null) {
  if (!eventId) return "/pages_meal/event/index";
  const eventQuery = `eventId=${encodeURIComponent(String(eventId))}`;
  if (planItemId && preview.value?.planDate) {
    return `/pages_meal/detail/index?planItemId=${encodeURIComponent(String(planItemId))}&planDate=${encodeURIComponent(preview.value.planDate)}&${eventQuery}`;
  }
  return `/pages_meal/detail/index?${eventQuery}`;
}

function openRecipeDetail(recipeId: UUID | null, recipeKind: "my" | "inspiration") {
  if (!recipeId) return;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=${recipeKind}`);
}

function buildAvatarFallback(name: string) {
  const text = name.trim();
  return (text[0] || "?").toUpperCase();
}

function padCountdown(value: number) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function startCountdownClock() {
  if (countdownTimer) return;
  nowMs.value = Date.now();
  countdownTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
}

function stopCountdownClock() {
  if (!countdownTimer) return;
  clearInterval(countdownTimer);
  countdownTimer = null;
}

function formatInviteDateTime(value: string) {
  const text = formatDateTimeMinute(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
  if (!match) return text;
  return `${match[1]}年${match[2]}月${match[3]}日 · ${match[4]}`;
}
</script>

<style scoped lang="scss">
.preview-shell {
  padding: var(--space-md) var(--space-page) calc(var(--space-xl) + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.notice,
.invite-card {
  border-radius: 24rpx;
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.notice {
  margin: var(--space-md) var(--space-page);
  padding: var(--space-md);
}

.invite-card {
  overflow: hidden;
}

.invite-skeleton {
  pointer-events: none;
}

.skeleton-block {
  position: relative;
  overflow: hidden;
  border-radius: 8rpx;
  background: var(--color-surface-muted);
}

.skeleton-block::after {
  position: absolute;
  inset: 0;
  content: "";
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, var(--color-shimmer-strong), transparent);
  animation: skeleton-shimmer 1.35s ease-in-out infinite;
}

.skeleton-block--avatar,
.skeleton-block--participant {
  border-radius: 999rpx;
}

.skeleton-block--avatar {
  width: 76rpx;
  height: 76rpx;
}

.skeleton-block--host {
  width: 280rpx;
  height: 38rpx;
}

.skeleton-block--title {
  width: 420rpx;
  max-width: 82%;
  height: 48rpx;
}

.skeleton-block--label {
  width: 120rpx;
  height: 28rpx;
}

.skeleton-block--time {
  width: 320rpx;
  max-width: 78%;
  height: 34rpx;
}

.skeleton-block--participant {
  width: 70rpx;
  height: 70rpx;
}

.skeleton-block--menu {
  width: 100%;
  height: 34rpx;
  margin-top: 24rpx;
}

.skeleton-block--menu-short {
  width: 68%;
}

@keyframes skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}

.invite-card__section {
  padding: 28rpx;
}

.invite-card__divider {
  height: 1rpx;
  margin: 0 28rpx;
  background: var(--color-divider);
}

.invite-card__host {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.invite-card__host-main {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.invite-card__host-line {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}

.invite-card__label {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  line-height: 1;
  font-weight: bold;
}

.invite-card__host-name,
.invite-card__title,
.invite-card__time-value,
.invite-card__section-title {
  color: var(--color-text);
  font-weight: 700;
}

.invite-card__host-name {
  font-size: 34rpx;
}

.invite-card__host-suffix {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  border-radius: 999rpx;
  background: var(--color-tag-primary-bg);
  overflow: hidden;
  flex-shrink: 0;
}

.avatar--participant,
.avatar--guest {
  width: 70rpx;
  height: 70rpx;
}

.avatar--guest {
  width: 52rpx;
  height: 52rpx;
}

.avatar__image {
  width: 100%;
  height: 100%;
}

.avatar__fallback {
  color: var(--color-tag-primary-text);
  font-size: 28rpx;
  font-weight: 700;
}

.invite-card__cover {
  height: 280rpx;
  margin-bottom: 24rpx;
  overflow: hidden;
  border-radius: 12rpx;
}

.invite-card__cover-image {
  width: 100%;
  height: 100%;
}

.invite-card__title {
  display: block;
  font-size: 38rpx;
  line-height: 1.28;
}

.invite-card__time {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 24rpx;
}

.invite-card__time-value {
  font-size: 28rpx;
  line-height: 1.5;
}

.invite-card__section-title {
  display: block;
  font-size: 28rpx;
  line-height: 1.5;
}

.participant-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  margin-top: 20rpx;
}

.participant-strip__item {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.menu-list {
  margin-top: 12rpx;
}

.menu-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 60rpx;
}

.menu-list__row + .menu-list__row {
  border-top: 1rpx solid var(--color-divider);
}

.menu-list__row--link {
  cursor: pointer;
}

.menu-list__name {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.5;
}

.menu-list__action {
  color: var(--color-support-action);
  font-size: 22rpx;
}

.menu-list__empty,
.invite-footer__status {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.invite-footer {
  padding: 28rpx;
}

.invite-footer__panel {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.invite-footer__guest {
  display: flex;
  justify-content: flex-end;
  padding: 28rpx 0;
}

.invite-footer__guest-main {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.invite-footer__guest-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.invite-footer__guest-name {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.4;
}

.invite-footer__countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 0;
  flex-wrap: nowrap;
}

.meal-footer__countdown-prefix,
.meal-footer__countdown-unit,
.meal-footer__countdown-separator,
.meal-footer__countdown-suffix {
  display: block;
  flex: 0 0 auto;
  font-size: 22rpx;
  line-height: 1.5;
}

.meal-footer__countdown-prefix,
.meal-footer__countdown-unit,
.meal-footer__countdown-suffix {
  color: var(--color-text-secondary);
}

.meal-footer__countdown-separator {
  color: var(--color-text);
  font-weight: 700;
}

.meal-footer__countdown-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 8rpx;
  border-radius: 10rpx;
  background: var(--color-state-danger-soft);
  color: var(--color-text-inverse);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
}

.invite-footer__hint {
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  background: var(--color-support-notice);
}

.invite-footer__hint-text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  font-weight: 700;
}

.invite-footer__button {
  width: 100%;
  margin: 0;
  border: 0;
  border-radius: 14rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: 30rpx;
  font-weight: 700;
  box-shadow: var(--button-primary-shadow);
  -webkit-backdrop-filter: var(--button-primary-filter);
  backdrop-filter: var(--button-primary-filter);
}

.invite-footer__button::after {
  border: none;
}

.invite-footer__button--secondary {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.invite-footer__status {
  text-align: center;
  color: var(--color-text-secondary);
}

.invite-footer__error {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--color-state-danger-text);
}
</style>
