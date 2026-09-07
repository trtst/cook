<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-capsule-guard="true" :navbar-placeholder="false" navbar-transparent>
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

        <view v-else-if="errorText" class="detail-state detail-state--error" :style="pageBodyStyle" @click="reload">
          <text class="detail-state__title">文章加载失败</text>
          <text class="detail-state__text">{{ errorText }}</text>
          <text class="detail-state__action">点击重试</text>
        </view>

        <template v-else-if="detail">
          <view class="detail-cover">
            <image v-if="detail.coverImageUrl" class="detail-cover__image" :src="detail.coverImageUrl" mode="aspectFill" />
            <ImageEmpty v-else class="detail-cover__empty" copy="封面图" ratio="fill" />
          </view>

          <view class="detail-content">
            <text class="detail-title">{{ detail.title }}</text>
            <view class="detail-meta">
              <view class="detail-meta__item">
                <text class="detail-meta__icon cookfont icon-time" />
                <text>{{ formatFullDate(detail.publishedAt) }}</text>
              </view>
              <view class="detail-meta__item">
                <text class="detail-meta__icon cookfont icon-read" />
                <text>{{ detail.viewCount }}</text>
              </view>
              <view
                class="detail-meta__item detail-meta__item--like"
                :class="{
                  'detail-meta__item--active': detail.viewerHasLiked,
                  'detail-meta__item--disabled': likeSubmitting
                }"
                hover-class="detail-meta__item--hover"
                hover-stay-time="100"
                @click="toggleLike"
              >
                <text class="detail-meta__icon cookfont icon-like" />
                <text>{{ detail.likeCount }}</text>
              </view>
            </view>
            <text v-if="detail.summary" class="detail-summary">{{ detail.summary }}</text>
            <view v-if="keywordList.length" class="detail-keywords">
              <view v-for="keyword in keywordList" :key="keyword" class="detail-keyword">{{ keyword }}</view>
            </view>

            <view class="detail-article">
              <ArticleBody :html="detail.bodyHtml" />
            </view>

            <view class="detail-bottom-like">
              <view
                class="detail-bottom-like__button"
                :class="{
                  'detail-bottom-like__button--active': detail.viewerHasLiked,
                  'detail-bottom-like__button--disabled': likeSubmitting
                }"
                hover-class="detail-bottom-like__button--hover"
                hover-stay-time="100"
                @click="toggleLike"
              >
                <text class="cookfont icon-like detail-bottom-like__icon" />
              </view>
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
import ArticleBody from "../components/ArticleBody.vue";
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
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();

const articleId = ref(0);
const detail = ref<KnowledgeArticleDetail | null>(null);
const loading = ref(true);
const loaded = ref(false);
const errorText = ref("");
const scrollTop = ref(0);
const likeSubmitting = ref(false);
const viewRecorded = ref(false);

const NAV_FADE_DISTANCE = 100;
const navTitle = computed(() => detail.value?.title || "文章详情");
const keywordList = computed(() => splitKeywords(detail.value?.keywords ?? null));
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
    loading.value = false;
    loaded.value = true;
    errorText.value = "文章不存在";
    return;
  }

  loading.value = true;
  errorText.value = "";
  try {
    detail.value = await knowledgeApi.getArticleDetail(articleId.value);
    loaded.value = true;
    await recordViewOnce();
  } catch (error) {
    detail.value = null;
    loaded.value = true;
    errorText.value = error instanceof Error ? error.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}

async function recordViewOnce() {
  if (!detail.value || viewRecorded.value || !sessionStore.isLoggedIn) return;
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

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function splitKeywords(value: string | null) {
  return value
    ? value
        .replace(/；/gu, ";")
        .split(";")
        .map(item => item.trim())
        .filter(Boolean)
    : [];
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
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
  display: block;
  width: 100%;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-align: left;
  text-overflow: ellipsis;
  transition: opacity 0.16s ease, transform 0.16s ease;
  white-space: nowrap;
  padding-right: var(--space-page);
}

.detail-page {
  min-height: 100vh;
  padding-bottom: max(80rpx, calc(env(safe-area-inset-bottom) + 48rpx));
  background: var(--color-surface);
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

.detail-cover {
  position: relative;
  min-height: 0;
  padding-top: 75%;
  overflow: hidden;
  background: var(--page-cover-fresh-shell-bg);
}

.detail-cover__image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: var(--color-surface);
}

.detail-cover__empty {
  position: absolute;
  inset: 0;
}

.detail-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-right: var(--space-page);
  padding-left: var(--space-page);
  padding-top: 34rpx;
}

.detail-title {
  display: block;
  color: var(--color-text);
  font-size: 50rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.3;
}

.detail-meta {
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.detail-meta__item {
  display: inline-flex;
  gap: 8rpx;
  align-items: center;
  min-height: 42rpx;
}

.detail-meta__icon.cookfont {
  color: inherit;
  font-size: 26rpx;
  line-height: 1;
}

.detail-meta__item--active {
  color: var(--color-support-action);
  font-weight: var(--font-weight-semibold);
}

.detail-meta__item--disabled {
  opacity: 0.7;
}

.detail-meta__item--hover {
  opacity: 0.72;
}

.detail-summary {
  display: block;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface-soft-panel);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  line-height: 1.8;
}

.detail-keywords {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.detail-keyword {
  display: inline-flex;
  align-items: center;
  min-height: 38rpx;
  padding: 0 16rpx;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.detail-article {
  padding-top: 12rpx;
}

.detail-bottom-like {
  display: flex;
  justify-content: center;
  padding-top: 30rpx;
  padding-bottom: 12rpx;
}

.detail-bottom-like__button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100rpx;
  height: 100rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-text-tertiary);
  background: var(--color-surface-soft-panel);
}

.detail-bottom-like__button--active {
  border-color: var(--color-border-active);
  color: var(--color-support-action);
  background: var(--color-tag-primary-bg);
}

.detail-bottom-like__button--disabled {
  opacity: 0.7;
}

.detail-bottom-like__button--hover {
  opacity: 0.72;
}

.detail-bottom-like__icon {
  color: inherit;
  font-size: 38rpx;
  line-height: 1;
}
</style>
