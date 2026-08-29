<template>
  <page-meta :page-style="themePageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="detail-navbar__title" :style="navTitleStyle">{{ navTitle }}</text>
    </template>
    <view class="detail-navbar__backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="detail-scroll" :show-scrollbar="false" @scroll="handleScroll">
      <view class="detail-page">
        <view v-if="showSkeleton" class="detail-skeleton" :style="pageBodyStyle">
          <Skeleton width="180rpx" height="30rpx" />
          <Skeleton width="72%" height="52rpx" />
          <Skeleton width="56%" height="52rpx" />
          <view class="detail-skeleton__meta">
            <Skeleton width="120rpx" height="24rpx" />
            <Skeleton width="120rpx" height="24rpx" />
            <Skeleton width="120rpx" height="24rpx" />
          </view>
          <Skeleton width="100%" height="340rpx" radius="32rpx" />
          <Skeleton width="100%" height="30rpx" />
          <Skeleton width="100%" height="30rpx" />
          <Skeleton width="88%" height="30rpx" />
          <Skeleton width="100%" height="30rpx" />
          <Skeleton width="76%" height="30rpx" />
        </view>

        <view v-else-if="needLogin" class="detail-state" :style="pageBodyStyle" @click="reload">
          <text class="detail-state__title">请先登录</text>
          <text class="detail-state__text">登录后查看文章内容</text>
          <text class="detail-state__action">点击登录</text>
        </view>

        <view v-else-if="errorText" class="detail-state detail-state--error" :style="pageBodyStyle" @click="reload">
          <text class="detail-state__title">文章加载失败</text>
          <text class="detail-state__text">{{ errorText }}</text>
          <text class="detail-state__action">点击重试</text>
        </view>

        <template v-else-if="detail">
          <view class="detail-hero">
            <image v-if="detail.coverImageUrl" class="detail-hero__cover" :src="detail.coverImageUrl" mode="aspectFill" />
            <view v-else class="detail-hero__cover detail-hero__cover--empty">
              <text class="detail-hero__empty-text">{{ detail.channelName }}</text>
            </view>
            <view class="detail-hero__mask" />

            <view class="detail-hero__content" :style="pageBodyStyle">
              <text class="detail-hero__eyebrow">{{ detail.channelName }}</text>
              <text class="detail-hero__title">{{ detail.title }}</text>
              <view class="detail-hero__meta">
                <text>{{ formatFullDate(detail.publishedAt) }}</text>
                <text>{{ detail.viewCount }} 阅读</text>
                <text>{{ detail.likeCount }} 点赞</text>
              </view>
            </view>
          </view>

          <view class="detail-content">
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

    <view v-if="detail" class="detail-toolbar">
      <view class="detail-toolbar__meta">
        <text class="detail-toolbar__meta-text">{{ detail.viewCount }} 阅读</text>
        <text class="detail-toolbar__meta-text">{{ detail.likeCount }} 点赞</text>
      </view>
      <view
        :class="[
          'detail-toolbar__button',
          detail.viewerHasLiked ? 'detail-toolbar__button--active' : '',
          likeSubmitting ? 'detail-toolbar__button--disabled' : ''
        ]"
        @click="toggleLike"
      >
        {{ likeSubmitting ? "处理中..." : detail.viewerHasLiked ? "已点赞" : "点赞" }}
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Layout from "@/components/Layout/Layout.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { createOperationId } from "@/utils/operation-id";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { UnauthorizedError } from "@/apis/http";
import { knowledgeApi, type KnowledgeArticleDetail } from "../apis/knowledge";

const pageStyle = usePageScrollStyle();
const { themeVars } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();

const articleId = ref(0);
const detail = ref<KnowledgeArticleDetail | null>(null);
const loading = ref(true);
const loaded = ref(false);
const errorText = ref("");
const needLogin = ref(false);
const scrollTop = ref(0);
const likeSubmitting = ref(false);
const viewRecorded = ref(false);

const NAV_FADE_DISTANCE = 100;
const navTitle = computed(() => detail.value?.title || "文章详情");
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

onLoad((query) => {
  const rawArticleId = Array.isArray(query?.articleId) ? query.articleId[0] : query?.articleId;
  articleId.value = Number.isInteger(Number(rawArticleId)) && Number(rawArticleId) > 0 ? Number(rawArticleId) : 0;
  void loadDetail();
});

async function loadDetail() {
  if (!articleId.value) {
    needLogin.value = false;
    loading.value = false;
    loaded.value = true;
    errorText.value = "文章不存在";
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
    detail.value = await knowledgeApi.getArticleDetail(articleId.value);
    loaded.value = true;
    await recordViewOnce();
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
    errorText.value = error instanceof Error ? error.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}

async function recordViewOnce() {
  if (!detail.value || viewRecorded.value) return;
  viewRecorded.value = true;
  try {
    const result = await knowledgeApi.recordArticleView(detail.value.id, createOperationId());
    if (detail.value && result.articleId === detail.value.id) {
      detail.value.viewCount = result.viewCount;
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      viewRecorded.value = false;
    }
  }
}

async function toggleLike() {
  if (!detail.value || likeSubmitting.value) return;
  if (!sessionStore.isLoggedIn) {
    loginModalStore.open(null, () => {
      void toggleLike();
    });
    return;
  }

  likeSubmitting.value = true;
  try {
    const result = detail.value.viewerHasLiked
      ? await knowledgeApi.unlikeArticle(detail.value.id, createOperationId())
      : await knowledgeApi.likeArticle(detail.value.id, createOperationId());
    if (detail.value && result.articleId === detail.value.id) {
      detail.value.likeCount = result.likeCount;
      detail.value.viewerHasLiked = result.viewerHasLiked;
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      loginModalStore.open(null, () => {
        void toggleLike();
      });
      return;
    }
    await uniPlatform.feedback.toast({
      title: error instanceof Error ? error.message : "操作失败",
      icon: "none"
    }).catch(() => undefined);
  } finally {
    likeSubmitting.value = false;
  }
}

function reload() {
  loaded.value = false;
  viewRecorded.value = false;
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
  needLogin.value = false;
  loaded.value = false;
  viewRecorded.value = false;
  await loadDetail();
}

defineExpose({
  automatorApplySession
});
</script>

<style scoped lang="scss">
.detail-scroll {
  height: 100vh;
}

.detail-navbar__backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 10;
  background: var(--color-surface-soft-panel);
  box-shadow: var(--shadow-card);
}

.detail-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.detail-page {
  min-height: 100vh;
  padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
  background: var(--page-primary-soft-bg);
}

.detail-skeleton {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-right: var(--space-page);
  padding-left: var(--space-page);
}

.detail-skeleton__meta {
  display: flex;
  gap: 18rpx;
}

.detail-state {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-right: var(--space-page);
  padding-left: var(--space-page);
  text-align: center;
}

.detail-state__title {
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: var(--font-weight-bold);
}

.detail-state__text {
  max-width: 560rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.detail-state__action {
  color: var(--color-support-action);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.detail-hero {
  position: relative;
  min-height: 560rpx;
}

.detail-hero__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: var(--color-support-notice);
}

.detail-hero__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-hero__empty-text {
  color: var(--color-text-inverse-strong);
  font-size: 34rpx;
  font-weight: var(--font-weight-bold);
}

.detail-hero__mask {
  position: absolute;
  inset: 0;
  background: var(--overlay-image-mask);
}

.detail-hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 560rpx;
  justify-content: flex-end;
  padding-right: var(--space-page);
  padding-bottom: 40rpx;
  padding-left: var(--space-page);
}

.detail-hero__eyebrow {
  display: inline-flex;
  width: fit-content;
  min-height: 42rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: var(--color-surface-mask-weak);
  color: var(--color-text-inverse);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  align-items: center;
}

.detail-hero__title {
  display: block;
  margin-top: 18rpx;
  color: var(--color-text-inverse);
  font-size: 46rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.24;
}

.detail-hero__meta {
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
  margin-top: 18rpx;
  color: var(--color-text-inverse-muted);
  font-size: 24rpx;
}

.detail-content {
  margin-top: -28rpx;
  padding-right: var(--space-page);
  padding-left: var(--space-page);
}

.detail-note {
  padding: 24rpx 26rpx;
  border-radius: 28rpx;
  background: var(--color-support-notice);
  box-shadow: var(--shadow-card);
}

.detail-note__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.detail-article {
  margin-top: var(--space-lg);
  padding: 34rpx 30rpx 42rpx;
  border-radius: 32rpx;
  background: var(--color-surface-soft-card);
  box-shadow: var(--shadow-card);
}

.detail-article__rich {
  color: var(--color-text);
  font-size: 30rpx;
  line-height: 1.8;
}

.detail-toolbar {
  position: fixed;
  right: 28rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 28rpx;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 18rpx 18rpx 26rpx;
  border-radius: 999rpx;
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  backdrop-filter: var(--material-tabbar-filter);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
}

.detail-toolbar__meta {
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
}

.detail-toolbar__meta-text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.detail-toolbar__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 156rpx;
  min-height: 72rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.detail-toolbar__button--active {
  background: var(--color-tag-primary-bg);
  box-shadow: inset 0 0 0 1rpx var(--color-border-active);
  color: var(--color-tag-primary-text);
}

.detail-toolbar__button--disabled {
  opacity: 0.7;
}
</style>
