<template>
  <page-meta :page-style="pageStyle" />
  <Layout title="" full-screen :navbar-placeholder="false" navbar-transparent>
    <template #navbar-center>
      <text class="topic-nav-title" :style="navTitleStyle">{{ navTitle }}</text>
    </template>
    <view class="topic-nav-backdrop" :style="navBackdropStyle" />
    <scroll-view
      scroll-y
      class="topic-scroll"
      :show-scrollbar="false"
      :scroll-into-view="scrollAnchor"
      @scroll="handleTopicScroll"
    >
      <view id="topic-top" class="topic-body">
        <view v-if="loading && !topic" class="topic-state">加载中...</view>
        <view v-else-if="errorText" class="topic-state topic-state--error" @click="reload">{{ errorText }}</view>
        <Empty
          v-else-if="!topic"
          title="本周灵感还在准备中"
          description="运营整理好本期菜单后，这里会先放出本周推荐。"
        />

        <template v-else>
          <view class="topic-backdrop">
            <image v-if="topic.coverImageUrl" class="topic-backdrop__image" :src="topic.coverImageUrl" mode="aspectFill" />
            <view v-else class="topic-backdrop__image topic-backdrop__image--empty">
              <text class="topic-backdrop__empty-text">本周灵感</text>
            </view>
            <view class="topic-backdrop__blur" :style="heroStyle" />
            <view class="topic-backdrop__veil" />
          </view>

          <view class="topic-content" :style="contentStyle">
            <view class="topic-summary">
              <image v-if="topic.coverImageUrl" class="topic-summary__cover" :src="topic.coverImageUrl" mode="aspectFill" />
              <view v-else class="topic-summary__cover topic-summary__cover--empty">
                <text class="topic-summary__cover-text">灵感</text>
              </view>

              <view class="topic-summary__main">
                <view class="topic-summary__meta">
                  <text class="topic-chip">{{ recTypeText(topic.recType) }}</text>
                  <text class="topic-chip topic-chip--soft">第 {{ topic.issueNo }} 期</text>
                </view>
                <text class="topic-summary__title">{{ topic.title }}</text>
                <text v-if="topic.subTitle" class="topic-summary__sub">{{ topic.subTitle }}</text>
                <view class="topic-summary__stats">
                  <text class="topic-summary__stat">{{ topic.recipeCount }} 道推荐</text>
                  <text class="topic-summary__stat">{{ formatDate(topic.updatedAt) }} 更新</text>
                </view>
              </view>
            </view>

            <view class="topic-intro">
              <text class="topic-intro__desc">{{ topic.description }}</text>
            </view>

            <view class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title">本期推荐</text>
                <text class="topic-section__meta">{{ topic.items.length }} 道</text>
              </view>

              <view class="recipe-list">
                <view
                  v-for="item in topic.items"
                  :key="item.id"
                  class="recipe-card"
                  hover-class="recipe-card--hover"
                  hover-stay-time="100"
                  @click="openRecipe(item.id)"
                >
                  <image v-if="item.coverImageUrl" class="recipe-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                  <view v-else class="recipe-card__cover recipe-card__cover--empty">
                    <text class="recipe-card__cover-text">封面图</text>
                  </view>

                  <view class="recipe-card__body">
                    <view class="recipe-card__top">
                      <text class="recipe-card__sort">0{{ item.sort }}</text>
                      <text class="recipe-card__title">{{ item.title }}</text>
                    </view>
                    <text class="recipe-card__meta">{{ item.category.name }} · {{ formatDuration(item.duration) }}</text>
                    <text class="recipe-card__meta">{{ formatDifficulty(item.difficulty) }}</text>
                  </view>
                </view>
              </view>
            </view>

            <view v-if="visibleHistory.length" class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title">往期回顾</text>
                <text class="topic-section__meta">查看更多</text>
              </view>

              <scroll-view scroll-x class="history-scroll" show-scrollbar="false">
                <view class="history-row">
                  <view
                    v-for="item in visibleHistory"
                    :key="item.id"
                    class="history-card"
                    hover-class="history-card--hover"
                    hover-stay-time="100"
                    @click="openHistory(item.id)"
                  >
                    <image v-if="item.coverImageUrl" class="history-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                    <view v-else class="history-card__cover history-card__cover--empty">
                      <text class="history-card__cover-text">往期</text>
                    </view>
                    <view class="history-card__issue">
                      <text class="history-card__issue-text">第 {{ item.issueNo }} 期</text>
                    </view>
                    <view class="history-card__mask" />
                    <text class="history-card__title">{{ item.title }}</text>
                  </view>
                </view>
              </scroll-view>
            </view>
          </view>
        </template>
      </view>
    </scroll-view>

    <view v-if="topic?.items.length" class="recommend-fab" hover-class="recommend-fab--hover" hover-stay-time="100" @click="openPlanSheet">
      <text class="cookfont icon-add-plan recommend-fab__icon" />
    </view>

    <SheetShell
      v-if="sheetMounted && topic"
      :visible="sheetVisible"
      title="加入我的计划"
      subtitle="先挑一道这期想安排的菜，下一步继续去计划页定时间。"
      @close="closePlanSheet"
      @after-close="handleSheetAfterClose"
    >
      <view class="sheet-list">
        <view
          v-for="item in topic.items"
          :key="item.id"
          class="sheet-card"
          hover-class="sheet-card--hover"
          hover-stay-time="100"
          @click="pickRecipe(item.id)"
        >
          <image v-if="item.coverImageUrl" class="sheet-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
          <view v-else class="sheet-card__cover sheet-card__cover--empty">
            <text class="sheet-card__cover-text">封面图</text>
          </view>

          <view class="sheet-card__body">
            <text class="sheet-card__title">{{ item.title }}</text>
            <text class="sheet-card__meta">{{ item.category.name }} · {{ formatDuration(item.duration) }}</text>
          </view>

          <text class="sheet-card__action">安排这道</text>
        </view>
      </view>
    </SheetShell>
  </Layout>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { homeApi, type HomeTopicDetail, type HomeTopicType } from "@/apis/home";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import SheetShell from "@/components/Sheet/SheetShell.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { uniPlatform } from "@/platform/uni";

const pageStyle = usePageScrollStyle();
const { setLocked } = usePageScrollLock(Symbol("home-topic-sheet"));
const { navBarTotalHeight } = useSystemInfo();
const NAV_FADE_DISTANCE = 96;

const loading = ref(false);
const errorText = ref("");
const topic = ref<HomeTopicDetail | null>(null);
const topicId = ref(0);
const scrollAnchor = ref("");
const scrollTop = ref(0);
const sheetMounted = ref(false);
const sheetVisible = ref(false);

watch(
  () => sheetVisible.value,
  visible => {
    setLocked(visible);
  },
  { immediate: true }
);

const heroStyle = computed(() => {
  if (!topic.value?.coverImageUrl) return {};
  return {
    backgroundImage: `url(${topic.value.coverImageUrl})`
  };
});

const contentStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 24rpx)`
}));

const navTitle = computed(() => topic.value?.title || "本周灵感");
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const visibleHistory = computed(() => topic.value?.history.slice(0, 5) ?? []);
const navBackdropStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`,
  opacity: `${navProgress.value}`
}));
const navTitleStyle = computed(() => ({
  opacity: `${navProgress.value}`,
  transform: `translateY(${(1 - navProgress.value) * 8}rpx)`
}));

onLoad(query => {
  const rawTopicId = Array.isArray(query?.topicId) ? query.topicId[0] : query?.topicId;
  topicId.value = Number.isInteger(Number(rawTopicId)) && Number(rawTopicId) > 0 ? Number(rawTopicId) : 0;
  void loadTopic();
});

function recTypeText(value: HomeTopicType) {
  if (value === "WEEKEND_GATHERING") return "周末聚餐";
  if (value === "QUICK_AFTER_WORK") return "下班快做";
  if (value === "HOME_STYLE") return "家常下饭";
  if (value === "ONE_PERSON") return "一人食";
  if (value === "BREAKFAST") return "早餐灵感";
  return "轻松一餐";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${month}-${day}`;
}

function formatDuration(value: HomeTopicDetail["items"][number]["duration"]) {
  if (value === "WITHIN_15") return "15 分钟内";
  if (value === "BETWEEN_15_30") return "15~30 分钟";
  if (value === "BETWEEN_30_60") return "30~60 分钟";
  if (value === "OVER_60") return "1 小时以上";
  return "时长待补";
}

function formatDifficulty(value: HomeTopicDetail["items"][number]["difficulty"]) {
  if (value === "BEGINNER") return "新手友好";
  if (value === "EASY") return "轻松上手";
  if (value === "SKILLED") return "需要经验";
  if (value === "CHALLENGING") return "进阶挑战";
  return "难度待补";
}

async function loadTopic(nextId = topicId.value) {
  loading.value = true;
  try {
    if (nextId > 0) {
      const result = await homeApi.getTopic(nextId);
      topic.value = result.topic;
      topicId.value = result.topic.id;
    } else {
      const result = await homeApi.getCurrentTopic();
      topic.value = result.topic;
      topicId.value = result.topic?.id ?? 0;
    }
    errorText.value = "";
    jumpTop();
  } catch (error) {
    topic.value = null;
    errorText.value = error instanceof Error ? error.message : "加载本周灵感失败";
  } finally {
    loading.value = false;
  }
}

function jumpTop() {
  scrollAnchor.value = "topic-top";
  setTimeout(() => {
    scrollAnchor.value = "";
  }, 0);
}

function reload() {
  void loadTopic();
}

function handleTopicScroll(event: { detail?: { scrollTop?: number } }) {
  scrollTop.value = event.detail?.scrollTop ?? 0;
}

function openRecipe(recipeId: number) {
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=inspiration`);
}

function openHistory(nextId: number) {
  if (nextId === topicId.value) return;
  topicId.value = nextId;
  void loadTopic(nextId);
}

function openPlanSheet() {
  if (!topic.value?.items.length) return;
  sheetMounted.value = true;
  sheetVisible.value = false;
  void nextTick(() => {
    sheetVisible.value = true;
  });
}

function closePlanSheet() {
  sheetVisible.value = false;
}

function handleSheetAfterClose() {
  sheetMounted.value = false;
}

function pickRecipe(recipeId: number) {
  closePlanSheet();
  void uniPlatform.navigation.navigateTo(`/pages_meal/plan/index?recipeId=${encodeURIComponent(String(recipeId))}`);
}
</script>

<style scoped lang="scss">
.topic-scroll {
  height: 100%;
}

.topic-scroll {
  background: var(--color-page);
}

.topic-nav-backdrop {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 799;
  overflow: hidden;
  border-bottom: 1rpx solid var(--color-border);
  background: var(--color-tabbar-bg);
  box-shadow: 0 10rpx 24rpx var(--color-surface-mask-weak);
  pointer-events: none;
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  transition: opacity 180ms ease;
}

.topic-nav-title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: opacity 180ms ease, transform 180ms ease;
}

.topic-body {
  position: relative;
  min-height: 100%;
}

.topic-state {
  margin: 24rpx;
  padding: 28rpx 24rpx;
  border-radius: 28rpx;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 26rpx;
  text-align: center;
}

.topic-state--error {
  color: var(--color-primary);
}

.topic-backdrop {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 760rpx;
  overflow: hidden;
}

.topic-backdrop__image,
.topic-backdrop__blur,
.topic-backdrop__veil {
  position: absolute;
  inset: 0;
}

.topic-backdrop__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, var(--color-primary-soft) 0%, var(--color-page) 100%);
}

.topic-backdrop__empty-text {
  color: var(--color-text-secondary);
  font-size: 40rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
}

.topic-backdrop__blur {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: blur(28rpx);
  transform: scale(1.08);
}

.topic-backdrop__veil {
  opacity: 0.8;
  background:
    linear-gradient(180deg, var(--color-surface-mask-medium) 0%, var(--color-surface-mask-strong) 58%, var(--color-page) 100%);
    backdrop-filter: saturate(180%) blur(22rpx);
}

.topic-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.topic-summary {
  display: flex;
  gap: 30rpx;
  padding: 0 var(--space-page);
}

.topic-summary__cover {
  width: 200rpx;
  height: 200rpx;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface);
  box-shadow: 0 8rpx 20rpx var(--color-surface-mask-medium);
}

.topic-summary__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.topic-summary__cover-text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  font-weight: 700;
}

.topic-summary__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 14rpx;
  min-width: 0;
}

.topic-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.topic-chip {
  padding: 8rpx 16rpx;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: 600;
}

.topic-chip--soft {
  background: var(--color-surface-mask-strong);
  color: var(--color-text-secondary);
}

.topic-summary__title {
  color: var(--color-text);
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.24;
}

.topic-summary__sub {
  color: var(--color-text-secondary);
  font-size: 25rpx;
  line-height: 1.5;
}

.topic-summary__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.topic-summary__stat {
  color: var(--color-text-secondary);
  font-size: 23rpx;
}

.topic-intro {
  display: flex;
  flex-direction: column;
  padding: 20rpx var(--space-page);
}

.topic-intro__desc {
  color: var(--color-text);
  font-size: 26rpx;
  line-height: 1.8;
}

.topic-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 20rpx var(--space-page) 0;
  background: var(--color-page);
}

.topic-section + .topic-section {
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom))
}

.topic-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topic-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: 700;
}

.topic-section__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recipe-card {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 28rpx;
  background: var(--color-surface);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.recipe-card--hover {
  transform: translateY(-2rpx);
}

.recipe-card__cover {
  width: 176rpx;
  height: 132rpx;
  flex: 0 0 auto;
  border-radius: 22rpx;
  overflow: hidden;
  background: var(--color-surface-muted);
}

.recipe-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-card__cover-text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

.recipe-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
  min-width: 0;
}

.recipe-card__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.recipe-card__sort {
  color: var(--color-primary);
  font-size: 22rpx;
  font-weight: 700;
}

.recipe-card__title {
  color: var(--color-text);
  font-size: 29rpx;
  font-weight: 700;
}

.recipe-card__meta {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.history-scroll {
  margin-right: -24rpx;
}

.history-row {
  display: flex;
  gap: var(--space-page);
}

.history-card {
  position: relative;
  width: 540rpx;
  height: 300rpx;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  transition: transform 0.18s ease;
}

.history-card--hover {
  transform: translateY(-2rpx);
}

.history-card__cover {
  width: 100%;
  height: 300rpx;
  background: var(--color-surface-muted);
}

.history-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-card__cover-text {
  color: var(--color-text-secondary);
  font-size: 26rpx;
}

.history-card__issue {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  font-size: 0;
  border-radius: 0 0 0 var(--radius-xs);
  background: var(--color-surface-mask-strong);
  padding: 8rpx 16rpx;
}

.history-card__issue-text {
  color: var(--color-text);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1;
}

.history-card__mask {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 90rpx;
  background: linear-gradient(180deg, transparent 0%, var(--color-surface-mask-weak) 30%, var(--color-surface-mask-medium) 50%,  var(--color-surface-mask-strong) 100%);
}

.history-card__title {
  position: absolute;
  right: 20rpx;
  bottom: 18rpx;
  left: 20rpx;
  overflow: hidden;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-fab {
  position: fixed;
  right: 32rpx;
  bottom: calc(52rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 90rpx;
  height: 90rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    135deg,
    var(--button-primary-gradient-start) 0%,
    var(--button-primary-gradient-end) 100%
  );
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.recommend-fab--hover {
  opacity: 0.92;
}

.recommend-fab__icon {
  line-height: 1;
  color: currentColor;
}

.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding-bottom: env(safe-area-inset-bottom);
}

.sheet-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: var(--color-surface);
}

.sheet-card--hover {
  background: var(--color-surface-muted);
}

.sheet-card__cover {
  width: 128rpx;
  height: 96rpx;
  flex: 0 0 auto;
  border-radius: 18rpx;
  overflow: hidden;
  background: var(--color-surface-muted);
}

.sheet-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-card__cover-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.sheet-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.sheet-card__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
}

.sheet-card__meta {
  color: var(--color-text-secondary);
  font-size: 23rpx;
}

.sheet-card__action {
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
}
</style>
