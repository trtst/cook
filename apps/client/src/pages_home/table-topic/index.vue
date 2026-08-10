<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="topic-nav-title" :style="navTitleStyle">餐桌话题</text>
    </template>
    <view class="topic-nav-backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="topic-scroll" :show-scrollbar="false" @scroll="handleScroll">
      <view class="topic-page" :style="pagePaddingStyle">
        <view class="topic-hero">
          <text class="topic-hero__eyebrow">历次话题</text>
          <text class="topic-hero__title">从最近一顿饭开始看</text>
          <text class="topic-hero__desc">每次一个新话题，按时间倒序收在这里。点进详情后可以直接参与。</text>
        </view>

        <view v-if="loading && !items.length" class="topic-state">加载中...</view>
        <view v-else-if="errorText && !items.length" class="topic-state topic-state--error" @click="reload">{{ errorText }}</view>
        <Empty
          v-else-if="!items.length"
          title="餐桌话题还在准备中"
          description="等第一期上架后，这里会按时间倒序展示历次话题。"
        />

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
            <view v-else class="topic-card__cover topic-card__cover--empty">
              <text class="topic-card__empty-text">餐桌话题</text>
            </view>

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
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";
import { tableTopicsApi, type TableTopicListItem } from "../apis/table-topics";
import { formatDateTimeMinute } from "../utils/date";

const pageStyle = usePageScrollStyle();
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
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 10rpx 32rpx rgba(17, 24, 39, 0.08);
}

.topic-nav-title {
  color: #111827;
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
  background:
    radial-gradient(circle at top right, rgba(255, 215, 160, 0.28), transparent 34%),
    linear-gradient(180deg, #fff7eb 0%, #fffdf8 28%, #f7f4ee 100%);
}

.topic-hero {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 20rpx 4rpx 8rpx;
}

.topic-hero__eyebrow {
  color: #9a5a2c;
  font-size: 24rpx;
  letter-spacing: 4rpx;
}

.topic-hero__title {
  color: #111827;
  font-size: 56rpx;
  font-weight: 700;
  line-height: 1.1;
}

.topic-hero__desc {
  color: #5b6473;
  font-size: 28rpx;
  line-height: 1.7;
}

.topic-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.88);
  color: #6b7280;
}

.topic-state--error {
  color: #c2410c;
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.topic-card {
  overflow: hidden;
  border-radius: 32rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 20rpx 48rpx rgba(17, 24, 39, 0.08);
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.topic-card--hover {
  transform: translateY(-4rpx);
  box-shadow: 0 28rpx 56rpx rgba(17, 24, 39, 0.12);
}

.topic-card__cover {
  display: block;
  width: 100%;
  height: 320rpx;
  background: #f3f4f6;
}

.topic-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top right, rgba(255, 177, 109, 0.42), transparent 40%),
    linear-gradient(135deg, #fff5e4, #ffe6ca);
}

.topic-card__empty-text {
  color: #9a5a2c;
  font-size: 34rpx;
  font-weight: 700;
}

.topic-card__body {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 26rpx 24rpx 28rpx;
}

.topic-card__title {
  color: #111827;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.4;
}

.topic-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12rpx;
  color: #6b7280;
  font-size: 24rpx;
}

.topic-card__meta-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: var(--radius-pill);
  background: rgba(107, 114, 128, 0.48);
}
</style>
