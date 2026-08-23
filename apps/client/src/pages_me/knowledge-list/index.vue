<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="">
    <template #navbar-center>
      <text class="knowledge-navbar__title">{{ channelMeta?.title || "厨房知识" }}</text>
    </template>

    <view class="knowledge-scroll-wrap">
      <RecipeSearchLoading
        :pull-distance="pullDistance"
        :refreshing="refreshing"
        :show-success="showSuccess"
        :refresher-text="refresherText"
        :threshold="refresherThreshold"
      />

      <scroll-view
        scroll-y
        class="knowledge-scroll"
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
        <view class="knowledge-page">
          <view class="knowledge-hero">
            <text class="knowledge-hero__eyebrow">厨房知识</text>
            <text class="knowledge-hero__title">{{ channelMeta?.title || "内容准备中" }}</text>
            <text class="knowledge-hero__description">{{ channelMeta?.description || "登录后查看文章内容" }}</text>
          </view>

          <view v-if="showSkeleton" class="knowledge-list">
            <view v-for="index in 4" :key="index" class="knowledge-item knowledge-item--skeleton">
              <view class="knowledge-item__body knowledge-item__body--skeleton">
                <Skeleton width="72%" height="34rpx" />
                <Skeleton width="48%" height="34rpx" />
                <view class="knowledge-item__meta-row">
                  <Skeleton width="120rpx" height="24rpx" />
                  <Skeleton width="120rpx" height="24rpx" />
                  <Skeleton width="120rpx" height="24rpx" />
                </view>
              </view>
              <Skeleton width="188rpx" height="136rpx" radius="24rpx" />
            </view>
          </view>

          <view v-else-if="needLogin" class="knowledge-status">
            <text class="knowledge-status__text">请先登录后查看文章</text>
            <button class="knowledge-status__button" @click="reload">去登录</button>
          </view>

          <view v-else-if="errorText" class="knowledge-status">
            <text class="knowledge-status__text">{{ errorText }}</text>
            <button class="knowledge-status__button" @click="reload">重新加载</button>
          </view>

          <Empty
            v-else-if="!articles.length"
            class="knowledge-empty"
            plain
            title="还没有文章"
            description="这里暂时还没有内容，晚点再来看看。"
          />

          <view v-else class="knowledge-list">
            <view
              v-for="item in articles"
              :key="item.id"
              class="knowledge-item"
              hover-class="knowledge-item--hover"
              hover-stay-time="100"
              @click="openArticle(item.id)"
            >
              <view class="knowledge-item__body">
                <text class="knowledge-item__title">{{ item.title }}</text>
                <view class="knowledge-item__meta-row">
                  <text>{{ formatMonthDay(item.publishedAt) }}</text>
                  <text>{{ item.viewCount }} 阅读</text>
                  <text>{{ item.likeCount }} 点赞</text>
                </view>
              </view>

              <image
                v-if="item.coverImageUrl"
                class="knowledge-item__thumb"
                :src="item.coverImageUrl"
                mode="aspectFill"
              />
              <view v-else class="knowledge-item__thumb knowledge-item__thumb--empty">
                <text class="knowledge-item__thumb-text">{{ channelMeta?.title || "文章" }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import {
  buildKnowledgeDetailPath,
  getKnowledgeChannel,
  type KnowledgeChannelCode
} from "@/config/knowledge-articles";
import { uniPlatform } from "@/platform/uni";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { UnauthorizedError } from "@/apis/http";
import { knowledgeApi, type KnowledgeArticleSummary } from "../apis/knowledge";

const pageStyle = usePageScrollStyle();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
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
    pulling: "下拉刷新文章",
    canRelease: ["松手刷新文章", "更新当前栏目"],
    success: "文章已刷新"
  }
});

const channelCode = ref<KnowledgeChannelCode | null>(null);
const articles = ref<KnowledgeArticleSummary[]>([]);
const loading = ref(true);
const loaded = ref(false);
const errorText = ref("");
const needLogin = ref(false);

const channelMeta = computed(() => getKnowledgeChannel(channelCode.value));
const showSkeleton = computed(() => loading.value && !loaded.value);

onLoad((query) => {
  const rawCode = Array.isArray(query?.channelCode) ? query.channelCode[0] : query?.channelCode;
  const meta = getKnowledgeChannel(typeof rawCode === "string" ? rawCode : "");
  channelCode.value = meta?.code ?? null;
  void loadArticles();
});

async function loadArticles() {
  if (!channelCode.value) {
    needLogin.value = false;
    loading.value = false;
    loaded.value = true;
    errorText.value = "栏目不存在";
    return;
  }

  if (!sessionStore.isLoggedIn) {
    showLoginState();
    loginModalStore.open(null, () => {
      needLogin.value = false;
      loaded.value = false;
      void loadArticles();
    });
    return;
  }

  loading.value = true;
  needLogin.value = false;
  errorText.value = "";
  try {
    const result = await knowledgeApi.listArticles(channelCode.value);
    articles.value = result.items;
    loaded.value = true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      showLoginState();
      loginModalStore.open(null, () => {
        needLogin.value = false;
        loaded.value = false;
        void loadArticles();
      });
      return;
    }
    articles.value = [];
    loaded.value = true;
    errorText.value = error instanceof Error ? error.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}

function reload() {
  loaded.value = false;
  void loadArticles();
}

function showLoginState() {
  articles.value = [];
  loading.value = false;
  loaded.value = true;
  errorText.value = "";
  needLogin.value = true;
}

async function handleRefresherRefresh() {
  const shouldRefresh = onRefresherRefresh();
  if (!shouldRefresh) {
    onRefresherRestore();
    return;
  }

  try {
    await loadArticles();
    await onRefreshComplete();
  } finally {
    onRefresherRestore();
  }
}

function openArticle(articleId: number) {
  void uniPlatform.navigation.navigateTo(buildKnowledgeDetailPath(articleId));
}

function formatMonthDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

async function automatorApplySession(snapshot: { token: string; uid?: number; expiresAt: string; refreshCheckedAt?: number }) {
  await sessionStore.setSession(snapshot);
  needLogin.value = false;
  loaded.value = false;
  await loadArticles();
}

defineExpose({
  automatorApplySession
});
</script>

<style scoped lang="scss">
.knowledge-scroll-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--theme-primary) 10%, transparent), transparent 34%),
    linear-gradient(0deg, color-mix(in srgb, var(--color-page) 78%, white) 0%, var(--color-page) 100%);
}

.knowledge-scroll {
  height: 100%;
}

.knowledge-navbar__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.knowledge-page {
  min-height: 100%;
  padding-right: var(--space-page);
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.knowledge-hero {
  padding: 20rpx 0 0;
}

.knowledge-hero__eyebrow {
  display: inline-flex;
  min-height: 40rpx;
  padding: 0 18rpx;
  border-radius: 999rpx;
  background: color-mix(in srgb, var(--theme-primary) 16%, white);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  align-items: center;
}

.knowledge-hero__title {
  display: block;
  margin-top: 18rpx;
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.knowledge-hero__description {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.knowledge-list {
  display: flex;
  flex-direction: column;
  margin-top: var(--space-lg);
}

.knowledge-empty {
  margin-top: var(--space-lg);
}

.knowledge-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 120rpx;
  margin-top: var(--space-lg);
  padding: 0 var(--space-md);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-muted) 84%, white);
}

.knowledge-status__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.knowledge-status__button {
  flex: 0 0 auto;
  min-height: 60rpx;
  padding: 0 20rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.knowledge-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: 30rpx 0;
  border-bottom: 1rpx solid color-mix(in srgb, var(--color-border-light) 80%, transparent);
}

.knowledge-item--hover {
  opacity: 0.9;
}

.knowledge-item--skeleton {
  align-items: center;
}

.knowledge-item__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.knowledge-item__body--skeleton {
  gap: 16rpx;
}

.knowledge-item__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.knowledge-item__meta-row {
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
  margin-top: 18rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.knowledge-item__thumb {
  flex: 0 0 188rpx;
  display: flex;
  gap: 14rpx;
  align-items: center;
  justify-content: center;
  width: 188rpx;
  height: 136rpx;
  overflow: hidden;
  border-radius: 24rpx;
  background: color-mix(in srgb, var(--theme-primary) 10%, var(--color-surface));
}

.knowledge-item__thumb-text {
  padding: 0 16rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  text-align: center;
}
</style>
