<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="detail-navbar__title" :style="navTitleStyle">{{ navTitle }}</text>
    </template>
    <view class="detail-navbar__backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false" @scroll="handleScroll">
      <view class="detail-page">
        <view v-if="showSkeleton" class="detail-skeleton" :style="pageBodyStyle">
          <Skeleton width="160rpx" height="30rpx" />
          <Skeleton width="78%" height="52rpx" />
          <Skeleton width="100%" height="280rpx" radius="32rpx" />
          <Skeleton width="100%" height="30rpx" />
          <Skeleton width="100%" height="30rpx" />
          <Skeleton width="82%" height="30rpx" />
        </view>

        <view v-else-if="needLogin" class="detail-state" :style="pageBodyStyle" @click="reload">
          <text class="detail-state__title">请先登录</text>
          <text class="detail-state__text">登录后查看官方消息</text>
          <text class="detail-state__action">点击登录</text>
        </view>

        <view v-else-if="errorText" class="detail-state detail-state--error" :style="pageBodyStyle" @click="reload">
          <text class="detail-state__title">消息加载失败</text>
          <text class="detail-state__text">{{ errorText }}</text>
          <text class="detail-state__action">点击重试</text>
        </view>

        <template v-else-if="detail">
          <view class="detail-hero">
            <image v-if="detail.coverImageUrl" class="detail-hero__cover" :src="detail.coverImageUrl" mode="aspectFill" />
            <ImageEmpty v-else class="detail-hero__cover detail-hero__cover--empty" copy="封面图" ratio="fill" />
            <view class="detail-hero__mask" />

            <view class="detail-hero__content" :style="pageBodyStyle">
              <text class="detail-hero__eyebrow">{{ detail.label || "官方消息" }}</text>
              <text class="detail-hero__title">{{ detail.title }}</text>
              <view class="detail-hero__meta">
                <text>{{ formatFullDate(detail.publishedAt || detail.updatedAt) }}</text>
              </view>
            </view>
          </view>

          <view class="detail-content">
            <view class="detail-summary">
              <text class="detail-summary__text">{{ detail.summary }}</text>
            </view>

            <view v-if="detail.heroNote" class="detail-note">
              <text class="detail-note__text">{{ detail.heroNote }}</text>
            </view>

            <view class="detail-article">
              <rich-text class="detail-article__rich" :nodes="detail.bodyHtml" />
            </view>
          </view>
        </template>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Layout from "@/components/Layout/Layout.vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { UnauthorizedError } from "@/apis/http";
import { officialMessageApi, type OfficialMessageDetail } from "../apis/official-message";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();

const messageId = ref(0);
const detail = ref<OfficialMessageDetail | null>(null);
const loading = ref(true);
const loaded = ref(false);
const errorText = ref("");
const needLogin = ref(false);
const scrollTop = ref(0);

const NAV_FADE_DISTANCE = 100;
const navTitle = computed(() => detail.value?.title || "官方消息");
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`,
  transform: `translateY(${(1 - navProgress.value) * 8}rpx)`
}));
const pageBodyStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 24rpx)`
}));
const showSkeleton = computed(() => loading.value && !loaded.value);

onLoad(query => {
  const rawMessageId = Array.isArray(query?.messageId) ? query.messageId[0] : query?.messageId;
  messageId.value = Number.isInteger(Number(rawMessageId)) && Number(rawMessageId) > 0 ? Number(rawMessageId) : 0;
  void loadDetail();
});

async function loadDetail() {
  if (!messageId.value) {
    detail.value = null;
    loading.value = false;
    loaded.value = true;
    needLogin.value = false;
    errorText.value = "消息不存在";
    return;
  }

  if (!sessionStore.isLoggedIn) {
    showLoginState();
    loginModalStore.open(null, () => {
      needLogin.value = false;
      loaded.value = false;
      void loadDetail();
    });
    return;
  }

  loading.value = true;
  needLogin.value = false;
  errorText.value = "";
  try {
    detail.value = await officialMessageApi.getDetail(messageId.value);
    loaded.value = true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLoginState();
      loginModalStore.open(null, () => {
        needLogin.value = false;
        loaded.value = false;
        void loadDetail();
      });
      return;
    }
    detail.value = null;
    loaded.value = true;
    errorText.value = error instanceof Error ? error.message : "消息加载失败";
  } finally {
    loading.value = false;
  }
}

function reload() {
  loaded.value = false;
  void loadDetail();
}

function showLoginState() {
  detail.value = null;
  loading.value = false;
  loaded.value = true;
  errorText.value = "";
  needLogin.value = true;
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  await loadDetail();
}

function automatorReadState() {
  return {
    loading: loading.value,
    loaded: loaded.value,
    errorText: errorText.value,
    needLogin: needLogin.value,
    detail: detail.value
      ? {
          title: detail.value.title,
          summary: detail.value.summary,
          publishedAt: detail.value.publishedAt,
          updatedAt: detail.value.updatedAt
        }
      : null
  };
}

defineExpose({
  automatorApplySession,
  automatorReadState
});
</script>

<style scoped lang="scss">
.detail-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  text-align: center;
}

.detail-navbar__backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  background: var(--page-navbar-backdrop-bg);
  -webkit-backdrop-filter: var(--page-backdrop-blur-filter);
  backdrop-filter: var(--page-backdrop-blur-filter);
  pointer-events: none;
}

.detail-scroll,
.detail-page {
  min-height: 100%;
}

.detail-page {
  background: var(--page-ambient-duo-bg);
}

.detail-skeleton,
.detail-content,
.detail-state {
  padding-right: var(--space-page);
  padding-left: var(--space-page);
}

.detail-skeleton,
.detail-state {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding-bottom: 48rpx;
}

.detail-state__title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-semibold);
}

.detail-state__text,
.detail-state__action,
.detail-summary__text,
.detail-note__text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}

.detail-state__action {
  color: var(--color-support-action);
}

.detail-hero {
  position: relative;
  min-height: 520rpx;
  overflow: hidden;
}

.detail-hero__cover {
  width: 100%;
  height: 520rpx;
}

.detail-hero__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--page-cover-fresh-bg);
}

.detail-hero__mask {
  position: absolute;
  inset: 0;
  background: var(--overlay-image-mask);
}

.detail-hero__content {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-right: var(--space-page);
  padding-bottom: 40rpx;
  padding-left: var(--space-page);
}

.detail-hero__eyebrow,
.detail-hero__meta text {
  color: var(--color-overlay-text-muted);
  font-size: 24rpx;
}

.detail-hero__title {
  color: var(--color-overlay-text);
  font-size: 44rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.28;
}

.detail-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-top: 28rpx;
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.detail-summary,
.detail-note,
.detail-article {
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.detail-summary,
.detail-note {
  padding: 24rpx 28rpx;
}

.detail-article {
  padding: 28rpx;
}

.detail-article__rich {
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.8;
}
</style>
