<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="topic-nav-title" :style="navTitleStyle">餐桌话题</text>
    </template>
    <view class="topic-nav-backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="topic-scroll" :show-scrollbar="false" @scroll="handleScroll">
      <view class="topic-page" :style="pagePaddingStyle">
        <view v-if="loading && !items.length" class="topic-state">加载中...</view>
        <view v-else-if="errorText && !items.length" class="topic-state topic-state--error" @click="reload">{{ errorText }}</view>
        <view v-else-if="!items.length" class="topic-empty">
          <Empty
            :art="emptyStateArt"
            title="还没有餐桌话题"
            description="新的话题发布后，会按时间顺序展示在这里。"
          />
        </view>
        <view v-else class="topic-list">
          <view
            v-for="item in items"
            :key="item.id"
            class="topic-card"
            hover-class="topic-card--hover"
            hover-stay-time="100"
            @click="openTopic(item.id)"
          >
            <image v-if="item.coverImageUrl" class="topic-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
            <ImageEmpty v-else class="topic-card__cover topic-card__cover--empty" copy="封面图" ratio="fill" />

            <view class="topic-card__body">
              <text class="topic-card__title">{{ item.title }}</text>
              <view class="topic-card__meta">
                <text class="topic-card__meta-item">{{ formatDateTimeMinute(item.activityAt) }}</text>
                <text class="topic-card__meta-dot" />
                <text class="topic-card__meta-item">{{ item.participantCount }} 人参与</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { tableTopicsApi, type TableTopicListItem } from "../apis/table-topics";
import { formatDateTimeMinute } from "../utils/date";
import emptyStateArt from "@/assets/empty.png";

const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { navBarTotalHeight } = useSystemInfo();
const loading = ref(false);
const errorText = ref("");
const items = ref<TableTopicListItem[]>([]);
const scrollTop = ref(0);
const NAV_FADE_DISTANCE = 96;

const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`,
  transform: `translateY(${(1 - navProgress.value) * 8}rpx)`
}));
const pagePaddingStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 28rpx)`
}));

onLoad(() => {
  void loadTopics();
});

async function loadTopics() {
  loading.value = true;
  try {
    const result = await tableTopicsApi.getTopics();
    items.value = result.items;
    errorText.value = "";
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : "加载餐桌话题失败";
  } finally {
    loading.value = false;
  }
}

function reload() {
  void loadTopics();
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openTopic(topicId: number) {
  void uniPlatform.navigation.navigateTo(`/pages_home/table-topic-detail/index?topicId=${encodeURIComponent(String(topicId))}`);
}
</script>

<style scoped lang="scss">
.topic-scroll {
  height: 100vh;
}

.topic-nav-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--color-surface-soft-card);
  box-shadow: var(--shadow-card);
}

.topic-nav-title {
  color: var(--color-text);
  font-size: 30rpx;
  font-weight: 700;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.topic-page {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  min-height: 100vh;
  padding-right: 28rpx;
  padding-left: 28rpx;
  padding-bottom: 40rpx;
  background: var(--page-secondary-soft-bg);
}

.topic-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320rpx;
  border-radius: 28rpx;
  background: var(--color-surface-soft-card);
  color: var(--color-text-secondary);
}

.topic-empty {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 520rpx;
}

.topic-empty::before {
  position: absolute;
  right: -160rpx;
  bottom: 40rpx;
  left: -160rpx;
  height: 260rpx;
  background: var(--page-hero-orb-bg);
  opacity: 0.24;
  transform: rotate(12deg);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  pointer-events: none;
  content: "";
}

.topic-empty :deep(.empty-state) {
  position: relative;
  z-index: 1;
  width: 100%;
  padding-top: 0;
  padding-bottom: 0;
}

.topic-state--error {
  color: var(--color-state-danger-text);
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.topic-card {
  overflow: hidden;
  border-radius: var(--radius-xs);
  background: var(--color-surface-soft-panel);
  box-shadow: var(--shadow-card);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.topic-card--hover {
  transform: translateY(-4rpx);
  box-shadow: var(--shadow-floating);
}

.topic-card__cover {
  display: block;
  width: 100%;
  height: 320rpx;
  background: var(--color-surface-muted);
}

.topic-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-cover-empty-warm-bg);
}

.topic-card__body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 26rpx 24rpx 28rpx;
}

.topic-card__title {
  color: var(--color-text);
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.4;
}

.topic-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.topic-card__meta-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: var(--radius-pill);
  background: var(--color-text-tertiary);
}
</style>
