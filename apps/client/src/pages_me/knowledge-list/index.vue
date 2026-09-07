<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="">
    <template #navbar-center>
      <text class="knowledge-navbar__title" :style="{ opacity: navbarTitleOpacity }">
        {{ channelMeta?.title || "厨房知识" }}
      </text>
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
        @scroll="handleScroll"
      >
        <view class="knowledge-page">
          <view class="knowledge-hero">
            <text class="knowledge-hero__title">{{ channelMeta?.title || "内容准备中" }}</text>
            <text class="knowledge-hero__description">{{ channelMeta?.description || "这里暂时还没有内容" }}</text>
          </view>

          <view v-if="showSkeleton" class="knowledge-list">
            <view v-for="index in 4" :key="index" class="knowledge-item knowledge-item--skeleton">
              <Skeleton width="100%" height="360rpx" radius="0" />
              <view class="knowledge-item__body knowledge-item__body--skeleton">
                <Skeleton width="72%" height="34rpx" />
                <Skeleton width="48%" height="34rpx" />
                <view class="knowledge-item__meta-row">
                  <Skeleton width="120rpx" height="24rpx" />
                  <Skeleton width="120rpx" height="24rpx" />
                  <Skeleton width="120rpx" height="24rpx" />
                </view>
              </view>
            </view>
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
              <image
                v-if="item.coverImageUrl"
                class="knowledge-item__thumb"
                :src="item.coverImageUrl"
                mode="aspectFill"
              />
              <ImageEmpty v-else class="knowledge-item__thumb knowledge-item__thumb--empty" copy="封面图" ratio="16-9" />

              <view class="knowledge-item__body">
                <text class="knowledge-item__title">{{ item.title }}</text>
                <text v-if="item.summary" class="knowledge-item__summary">{{ item.summary }}</text>
                <view v-if="splitKeywords(item.keywords).length" class="knowledge-item__keywords">
                  <text v-for="keyword in splitKeywords(item.keywords)" :key="keyword" class="knowledge-item__keyword">
                    {{ keyword }}
                  </text>
                </view>
                <view class="knowledge-item__meta-row">
                  <view class="knowledge-item__meta-item">
                    <text class="knowledge-item__meta-icon cookfont icon-time" />
                    <text>{{ formatMonthDay(item.publishedAt) }}</text>
                  </view>
                  <text class="knowledge-item__meta-sep">·</text>
                  <view class="knowledge-item__meta-item">
                    <text class="knowledge-item__meta-icon cookfont icon-read" />
                    <text>{{ item.viewCount }}</text>
                  </view>
                  <text class="knowledge-item__meta-sep">·</text>
                  <view class="knowledge-item__meta-item">
                    <text class="knowledge-item__meta-icon cookfont icon-like" />
                    <text>{{ item.likeCount }}</text>
                  </view>
                </view>
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
import ImageEmpty from "@/components/ImageEmpty.vue";
import Layout from "@/components/Layout/Layout.vue";
import RecipeSearchLoading from "@/components/Recipe/RecipeSearchLoading.vue";
import Skeleton from "@/components/Skeleton/Skeleton.vue";
import { useCustomRefresher } from "@/composables/useCustomRefresher";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import {
  buildKnowledgeDetailPath,
  getKnowledgeChannel,
  type KnowledgeChannelCode
} from "@/config/knowledge-articles";
import { uniPlatform } from "@/platform/uni";
import { knowledgeApi, type KnowledgeArticleSummary } from "../apis/knowledge";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
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
const serverChannel = ref<{ code: KnowledgeChannelCode; title: string; description: string } | null>(null);
const articles = ref<KnowledgeArticleSummary[]>([]);
const loading = ref(true);
const loaded = ref(false);
const errorText = ref("");
const scrollTop = ref(0);

const staticChannelMeta = computed(() => getKnowledgeChannel(channelCode.value));
const channelMeta = computed(() => serverChannel.value ?? staticChannelMeta.value);
const showSkeleton = computed(() => loading.value && !loaded.value);
const KNOWLEDGE_LIST_TOP = 180;
const NAVBAR_TITLE_FADE_DISTANCE = 96;
const navbarTitleOpacity = computed(() => {
  const distanceToNavbar = KNOWLEDGE_LIST_TOP - (scrollTop.value + navBarTotalHeight.value);
  return Math.min(1, Math.max(0, (NAVBAR_TITLE_FADE_DISTANCE - distanceToNavbar) / NAVBAR_TITLE_FADE_DISTANCE));
});

onLoad((query) => {
  const rawCode = Array.isArray(query?.channelCode) ? query.channelCode[0] : query?.channelCode;
  const meta = getKnowledgeChannel(typeof rawCode === "string" ? rawCode : "");
  channelCode.value = meta?.code ?? null;
  void loadArticles();
});

async function loadArticles() {
  if (!channelCode.value) {
    loading.value = false;
    loaded.value = true;
    errorText.value = "栏目不存在";
    return;
  }

  loading.value = true;
  errorText.value = "";
  try {
    const result = await knowledgeApi.listArticles(channelCode.value);
    serverChannel.value = {
      code: result.channel.code,
      title: result.channel.name,
      description: result.channel.description
    };
    articles.value = result.items;
    loaded.value = true;
  } catch (error) {
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

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function formatMonthDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "最近更新";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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

</script>

<style scoped lang="scss">
.knowledge-scroll-wrap {
  position: relative;
  height: 100%;
  min-height: 0;
  background: var(--page-ambient-primary-bg);
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

.knowledge-hero__title {
  display: block;
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
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.knowledge-status__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.knowledge-status__button {
  flex: 0 0 auto;
  min-height: 60rpx;
  padding: 0 20rpx;
  border-radius: var(--radius-md);
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  -webkit-backdrop-filter: var(--button-secondary-filter);
  backdrop-filter: var(--button-secondary-filter);
}

.knowledge-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-md);
  padding: 30rpx 0;
  border-bottom: 1rpx solid var(--color-border-light);
}

.knowledge-item:last-child {
  border-bottom: 0;
}

.knowledge-item--hover {
  opacity: 0.9;
}

.knowledge-item--skeleton {
  align-items: stretch;
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

.knowledge-item__summary {
  display: -webkit-box;
  margin-top: 12rpx;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.knowledge-item__keywords {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
  margin-top: 14rpx;
}

.knowledge-item__keyword {
  display: inline-flex;
  align-items: center;
  min-height: 36rpx;
  padding: 0 14rpx;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.knowledge-item__meta-row {
  display: flex;
  gap: 8rpx;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 18rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}

.knowledge-item__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
}

.knowledge-item__meta-icon.cookfont {
  font-size: 24rpx;
  line-height: 1;
  color: var(--color-text-quaternary);
}

.knowledge-item__meta-sep {
  color: var(--color-text-quaternary);
}

.knowledge-item__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface-soft-panel);
}

</style>
