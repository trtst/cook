<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="topic-nav-title" :style="navTitleStyle">{{ navTitle }}</text>
    </template>
    <view class="topic-nav-backdrop" :style="navBackdropStyle" />

    <scroll-view scroll-y class="topic-scroll" :show-scrollbar="false" @scroll="handleScroll">
      <view class="topic-page">
        <view v-if="loading && !topic" class="topic-state" :style="pagePaddingStyle">加载中...</view>
        <view v-else-if="errorText" class="topic-state topic-state--error" :style="pagePaddingStyle" @click="reload">{{ errorText }}</view>

        <template v-else-if="topic">
          <view class="topic-hero">
            <image v-if="topic.coverImageUrl" class="topic-hero__cover" :src="topic.coverImageUrl" mode="aspectFill" />
            <view v-else class="topic-hero__cover topic-hero__cover--empty">
              <text class="topic-hero__empty-text">餐桌话题</text>
            </view>
            <view class="topic-hero__mask" />

            <view class="topic-hero__content" :style="pagePaddingStyle">
              <text class="topic-hero__eyebrow">餐桌话题</text>
              <text class="topic-hero__title">{{ topic.title }}</text>
              <view class="topic-hero__meta">
                <text>{{ formatDateTimeMinute(topic.activityAt) }}</text>
                <text>{{ topic.participantCount }} 人参与</text>
              </view>
            </view>
          </view>

          <view class="topic-content">
            <view class="topic-panel">
              <text class="topic-panel__label">话题简介</text>
              <text class="topic-panel__summary">{{ topic.summary }}</text>
            </view>

            <view class="topic-panel topic-panel--actions">
              <view class="topic-panel__head">
                <text class="topic-panel__label">参与状态</text>
                <text class="topic-panel__joined">{{ topic.joined ? "你已参与" : "还没参与" }}</text>
              </view>
              <text class="topic-panel__hint">同一位用户只记一次参与，不支持取消。</text>

              <view
                :class="[
                  'topic-panel__button',
                  topic.joined ? 'topic-panel__button--joined' : '',
                  participateSubmitting ? 'topic-panel__button--disabled' : ''
                ]"
                @click="handleParticipate"
              >
                {{ topic.joined ? "已参与" : participateSubmitting ? "参与中..." : "点击参与" }}
              </view>

              <view v-if="topic.targetValue" class="topic-panel__link" @click="openTopicTarget">
                查看活动详情
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
import { usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { uniPlatform } from "@/platform/uni";
import { tableTopicsApi, type TableTopicDetail } from "../apis/table-topics";
import { createOperationId } from "@/utils/operation-id";
import { formatDateTimeMinute } from "../utils/date";

const pageStyle = usePageScrollStyle();
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const loading = ref(false);
const errorText = ref("");
const topic = ref<TableTopicDetail | null>(null);
const topicId = ref(0);
const scrollTop = ref(0);
const participateSubmitting = ref(false);
const NAV_FADE_DISTANCE = 96;

const navTitle = computed(() => topic.value?.title || "话题详情");
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

onLoad(query => {
  const rawTopicId = Array.isArray(query?.topicId) ? query.topicId[0] : query?.topicId;
  topicId.value = Number.isInteger(Number(rawTopicId)) && Number(rawTopicId) > 0 ? Number(rawTopicId) : 0;
  void loadTopic();
});

async function loadTopic() {
  if (!topicId.value) {
    errorText.value = "餐桌话题不存在";
    return;
  }
  loading.value = true;
  try {
    const result = await tableTopicsApi.getTopic(topicId.value);
    topic.value = result.topic;
    errorText.value = "";
  } catch (error) {
    topic.value = null;
    errorText.value = error instanceof Error ? error.message : "加载餐桌话题失败";
  } finally {
    loading.value = false;
  }
}

function reload() {
  void loadTopic();
}

function handleScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openLogin(action: () => void) {
  loginModalStore.open(null, action);
}

async function handleParticipate() {
  if (!topic.value || topic.value.joined || participateSubmitting.value) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      void handleParticipate();
    });
    return;
  }

  participateSubmitting.value = true;
  try {
    const result = await tableTopicsApi.participate(topic.value.id, createOperationId());
    topic.value = result.topic;
    await uniPlatform.feedback.toast({ title: "已参与", icon: "success" });
  } catch (error) {
    await uniPlatform.feedback.toast({ title: error instanceof Error ? error.message : "参与失败", icon: "none" });
  } finally {
    participateSubmitting.value = false;
  }
}

function openTopicTarget() {
  if (!topic.value?.targetValue) return;
  if (topic.value.targetType === "WEB_VIEW") {
    if (!/^https:\/\//iu.test(topic.value.targetValue)) return;
    void uniPlatform.navigation.navigateTo(`/pages_web/content/index?url=${encodeURIComponent(topic.value.targetValue)}`);
    return;
  }
  void uniPlatform.navigation.navigateTo(topic.value.targetValue);
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
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(255, 215, 160, 0.24), transparent 34%),
    linear-gradient(180deg, #fff7eb 0%, #fffdf8 34%, #f7f4ee 100%);
}

.topic-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: #6b7280;
}

.topic-state--error {
  color: #c2410c;
}

.topic-hero {
  position: relative;
  min-height: 540rpx;
}

.topic-hero__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #f3f4f6;
}

.topic-hero__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top right, rgba(255, 177, 109, 0.42), transparent 40%),
    linear-gradient(135deg, #fff5e4, #ffe6ca);
}

.topic-hero__empty-text {
  color: #9a5a2c;
  font-size: 40rpx;
  font-weight: 700;
}

.topic-hero__mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.1), rgba(17, 24, 39, 0.58));
}

.topic-hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  min-height: 540rpx;
  justify-content: flex-end;
  padding-right: 28rpx;
  padding-bottom: 36rpx;
  padding-left: 28rpx;
}

.topic-hero__eyebrow {
  color: rgba(255, 255, 255, 0.86);
  font-size: 24rpx;
  letter-spacing: 4rpx;
}

.topic-hero__title {
  color: #fff;
  font-size: 54rpx;
  font-weight: 700;
  line-height: 1.16;
}

.topic-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  color: rgba(255, 255, 255, 0.88);
  font-size: 24rpx;
}

.topic-content {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 28rpx;
}

.topic-panel {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 28rpx 26rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18rpx 40rpx rgba(17, 24, 39, 0.06);
}

.topic-panel__label {
  color: #9a5a2c;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.topic-panel__summary {
  color: #111827;
  font-size: 30rpx;
  line-height: 1.8;
}

.topic-panel--actions {
  gap: 18rpx;
}

.topic-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.topic-panel__joined {
  color: #1f7a45;
  font-size: 24rpx;
  font-weight: 600;
}

.topic-panel__hint {
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.6;
}

.topic-panel__button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #f07f35, #d8602a);
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
}

.topic-panel__button--joined {
  background: linear-gradient(135deg, #2f6f4e, #24583d);
}

.topic-panel__button--disabled {
  opacity: 0.72;
}

.topic-panel__link {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 84rpx;
  border: 2rpx solid rgba(47, 111, 78, 0.18);
  border-radius: var(--radius-pill);
  color: #2f6f4e;
  font-size: 28rpx;
  font-weight: 600;
  background: rgba(47, 111, 78, 0.06);
}
</style>
