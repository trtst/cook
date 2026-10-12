<template>
  <page-meta :page-style="themePageStyle" />
  <Layout :class="themeClasses" title="" full-screen :navbar-placeholder="false" navbar-transparent>
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
        <view v-else-if="!topic" class="topic-empty" :style="emptyStyle">
          <Empty :art="emptyStateArt" title="本周灵感还在准备中" description="新的菜谱推荐准备好后，会第一时间出现在这里。" />
        </view>

        <template v-else>
          <view class="topic-backdrop">
            <image v-if="topic.coverImageUrl" class="topic-backdrop__image" :src="topic.coverImageUrl" mode="aspectFill" />
            <ImageEmpty v-else class="topic-backdrop__image topic-backdrop__image--empty" copy="封面图" ratio="fill" />
            <view class="topic-backdrop__blur" :style="heroStyle" />
            <view class="topic-backdrop__veil" />
          </view>

          <view class="topic-content" :style="contentStyle">
            <view class="topic-summary">
              <image v-if="topic.coverImageUrl" class="topic-summary__cover" :src="topic.coverImageUrl" mode="aspectFill" />
              <ImageEmpty v-else class="topic-summary__cover topic-summary__cover--empty" copy="封面图" ratio="fill" />

              <view class="topic-summary__main">
                <view class="topic-summary__meta">
                  <text class="topic-chip">{{ topic.recTypeText }}</text>
                  <text class="topic-chip topic-chip--soft">第 {{ topic.issueNo }} 期</text>
                </view>
                <text class="topic-summary__title">{{ topic.title }}</text>
                <text v-if="topic.subTitle" class="topic-summary__sub">{{ topic.subTitle }}</text>
                <view class="topic-summary__stats">
                  <text class="topic-summary__stat">{{ weekRangeText }}</text>
                </view>
              </view>
            </view>

            <view class="topic-intro">
              <text class="topic-intro__desc">{{ topic.description }}</text>
            </view>

            <view class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title font-medium">本期菜单</text>
                <view v-if="dayItems.length" class="topic-section__meta" @click="addDayToPlan">
                  <text class="cookfont topic-section__meta-icon icon-add-plan" />
                  <text>加入计划</text>
                </view>
              </view>

              <view v-if="weekDays.length > 1" class="topic-weekdays">
                <view
                  v-for="day in weekDays"
                  :key="day.weekday"
                  :class="['topic-weekdays__day', selectedWeekday === day.weekday ? 'topic-weekdays__day--active' : '']"
                  @click="selectWeekday(day.weekday)"
                >
                  <text class="topic-weekdays__name">{{ day.name }}</text>
                  <text class="topic-weekdays__date">{{ day.dateText }}</text>
                </view>
              </view>

              <view v-if="dayItems.length" class="recipe-list">
                <view
                  v-for="(item, index) in dayItems"
                  :key="item.id"
                  :class="['recipe-card', index % 2 === 1 ? 'recipe-card--reverse' : '']"
                  hover-class="recipe-card--hover"
                  hover-stay-time="100"
                  @click="openRecipe(item.id)"
                >
                  <view class="recipe-card__layout">
                    <view class="recipe-card__rail">
                      <text class="recipe-card__part">PART</text>
                      <text class="recipe-card__sort">{{ formatSort(item.sort) }}</text>
                      <view class="recipe-card__meta-group">
                        <text class="recipe-card__meta-pill">{{ item.difficultyText || "难度待补" }}</text>
                        <text class="recipe-card__meta-pill">{{ item.durationText || "时长待补" }}</text>
                      </view>
                    </view>

                    <view class="recipe-card__content">
                      <image v-if="item.coverImageUrl" class="recipe-card__cover" :src="item.coverImageUrl" mode="aspectFill" />
                      <ImageEmpty v-else class="recipe-card__cover recipe-card__cover--empty" copy="封面图" ratio="fill" />

                      <view class="recipe-card__footer">
                        <view class="recipe-card__heading">
                          <text class="recipe-card__title">{{ item.title }}</text>
                          <view
                            :class="[
                              'recipe-card__action',
                              item.ownedRecipeId ? 'recipe-card__action--ready' : 'recipe-card__action--guide'
                            ]"
                            @click.stop="handleRecipeAction(item)"
                          >
                            <text class="cookfont recipe-card__action-icon icon-add-plan" />
                            <text>{{ recipeActionText(item) }}</text>
                          </view>
                        </view>
                        <text v-if="item.recommendNote" class="recipe-card__note">{{ item.recommendNote }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="topic-day-empty">本期暂时没有可公开查看的菜谱</view>
            </view>

            <view v-if="visibleHistory.length" class="topic-section">
              <view class="topic-section__head">
                <text class="topic-section__title">往期回顾</text>
                <text class="topic-section__meta" @click="openHistoryList">查看更多</text>
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
                    <ImageEmpty v-else class="history-card__cover history-card__cover--empty" copy="封面图" ratio="fill" />
                    <view class="history-card__issue">
                      <text class="history-card__issue-text">{{ formatWeekRange(item) }}</text>
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

    <AddToPlanSheet
      v-if="planSheetItems.length"
      :visible="planSheetVisible"
      :items="planSheetItems"
      @close="closePlanSheet"
    />
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { onLoad, onShareAppMessage, onShow } from "@dcloudio/uni-app";
import { homeApi, type HomeTopicDetail, type HomeTopicWeekday } from "@/apis/home";
import Empty from "@/components/Empty/Empty.vue";
import Layout from "@/components/Layout/Layout.vue";
import ImageEmpty from "@/components/ImageEmpty.vue";
import AddToPlanSheet from "@/components/Recipe/AddToPlanSheet.vue";
import { usePageScrollLock, usePageScrollStyle } from "@/composables/usePageScrollLock";
import { buildThemePageStyle } from "@/composables/theme-page-style";
import { useTheme } from "@/composables/useTheme";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useLoginModalStore } from "@/stores/login-modal";
import { useSessionStore } from "@/stores/session";
import { uniPlatform } from "@/platform/uni";
import emptyStateArt from "@/assets/empty.png";
import { formatSort } from "../utils/date";


const pageStyle = usePageScrollStyle();
const { themeVars, themeClasses } = useTheme();
const themePageStyle = computed(() => buildThemePageStyle(themeVars.value, pageStyle.value));
const { setLocked } = usePageScrollLock(Symbol("home-topic-sheet"));
const { navBarTotalHeight } = useSystemInfo();
const sessionStore = useSessionStore();
const loginModalStore = useLoginModalStore();
const NAV_FADE_DISTANCE = 96;
const WEEKDAYS: { weekday: HomeTopicWeekday; name: string }[] = [
  { weekday: "MONDAY", name: "周一" },
  { weekday: "TUESDAY", name: "周二" },
  { weekday: "WEDNESDAY", name: "周三" },
  { weekday: "THURSDAY", name: "周四" },
  { weekday: "FRIDAY", name: "周五" },
  { weekday: "SATURDAY", name: "周六" },
  { weekday: "SUNDAY", name: "周日" }
];

const loading = ref(false);
const errorText = ref("");
const topic = ref<HomeTopicDetail | null>(null);
const topicId = ref(0);
const historyBrowse = ref(false);
const selectedWeekday = ref<HomeTopicWeekday>("MONDAY");
const scrollAnchor = ref("");
const scrollTop = ref(0);
const planSheetVisible = ref(false);
const currentPlanItems = ref<HomeTopicDetail["items"]>([]);
const shouldRefreshOnShow = ref(false);

watch(() => planSheetVisible.value, visible => setLocked(visible), { immediate: true });

const heroStyle = computed(() => {
  if (!topic.value?.coverImageUrl) return {};
  return {
    backgroundImage: `url(${topic.value.coverImageUrl})`
  };
});

const contentStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 24rpx)`
}));
const emptyStyle = computed(() => ({
  paddingTop: `calc(${navBarTotalHeight.value}px + 32rpx)`
}));

const navTitle = computed(() => topic.value?.title || "本周灵感");
const navProgress = computed(() => Math.min(1, Math.max(0, scrollTop.value / NAV_FADE_DISTANCE)));
const visibleHistory = computed(() => topic.value?.history.slice(0, 5) ?? []);
const weekDays = computed(() => {
  const current = topic.value;
  if (!current) return [];
  const available = new Set(current.items.map(item => item.weekday));
  return WEEKDAYS.flatMap((item, index) => {
    if (!available.has(item.weekday)) return [];
    const date = addDays(current.periodStartDate, index);
    return date ? [{ ...item, date, dateText: formatDateLabel(date) }] : [];
  });
});
const selectedDay = computed(() => weekDays.value.find(day => day.weekday === selectedWeekday.value) ?? weekDays.value[0] ?? null);
const dayItems = computed(() => {
  const weekday = selectedDay.value?.weekday;
  if (!weekday || !topic.value) return [];
  return topic.value.items.filter(item => item.weekday === weekday).sort((left, right) => left.sort - right.sort);
});
const weekRangeText = computed(() => {
  if (!topic.value) return "";
  return formatWeekRange(topic.value);
});
const planSheetItems = computed(() => {
  return currentPlanItems.value.map(item => ({
    recipeId: item.ownedRecipeId ?? item.id,
    ...(!item.ownedRecipeId && item.sourceVersionId ? { recipeVersionId: item.sourceVersionId } : {})
  }));
});
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
  const rawHistoryBrowse = Array.isArray(query?.historyBrowse) ? query.historyBrowse[0] : query?.historyBrowse;
  topicId.value = Number.isInteger(Number(rawTopicId)) && Number(rawTopicId) > 0 ? Number(rawTopicId) : 0;
  historyBrowse.value = rawHistoryBrowse === "1";
  void loadTopic();
});

onShareAppMessage(() => ({
  title: topic.value ? `${weekRangeText.value}｜${topic.value.title}` : "炊火记共享周刊",
  path: topicId.value ? `/pages_home/topic/index?topicId=${encodeURIComponent(String(topicId.value))}` : "/pages_home/topic/index",
  imageUrl: topic.value?.coverImageUrl || "/static/assets/logo.png"
}));

onShow(() => {
  if (!shouldRefreshOnShow.value) return;
  shouldRefreshOnShow.value = false;
  void loadTopic(topicId.value, false);
});

function recipeActionText(item: HomeTopicDetail["items"][number]) {
  return item.ownedRecipeId ? "加入计划" : "加入计划";
}

async function loadTopic(nextId = topicId.value, resetScroll = true) {
  loading.value = true;
  try {
    if (nextId > 0) {
      const result = await homeApi.getTopic(nextId);
      topic.value = result.topic;
      topicId.value = result.topic.id;
      selectInitialWeekday(result.topic);
    } else {
      const result = await homeApi.getCurrentTopic();
      topic.value = result.topic;
      topicId.value = result.topic?.id ?? 0;
      if (result.topic) selectInitialWeekday(result.topic);
    }
    errorText.value = "";
    if (resetScroll) {
      jumpTop();
    }
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

function openRecipe(recipeId: number, refreshOnShow = true) {
  shouldRefreshOnShow.value = refreshOnShow;
  void uniPlatform.navigation.navigateTo(`/pages_recipe/detail/index?recipeId=${encodeURIComponent(String(recipeId))}&kind=inspiration`);
}

function openHistory(nextId: number) {
  if (nextId === topicId.value) return;
  const path = `/pages_home/topic/index?topicId=${encodeURIComponent(String(nextId))}&historyBrowse=1`;
  void (historyBrowse.value ? uniPlatform.navigation.redirectTo(path) : uniPlatform.navigation.navigateTo(path));
}

function openHistoryList() {
  void uniPlatform.navigation.navigateTo("/pages_home/topic-list/index");
}

function handleRecipeAction(item: HomeTopicDetail["items"][number]) {
  openPlanSheet([item]);
}

function addDayToPlan() {
  if (dayItems.value.length) openPlanSheet(dayItems.value);
}

function openLogin(afterLogin?: () => void) {
  loginModalStore.open(null, afterLogin);
}

function openPlanSheet(items: HomeTopicDetail["items"]) {
  if (!items.length) return;
  if (!sessionStore.isLoggedIn) {
    openLogin(() => {
      openPlanSheet(items);
    });
    return;
  }
  currentPlanItems.value = items;
  planSheetVisible.value = true;
}

function closePlanSheet() {
  planSheetVisible.value = false;
  currentPlanItems.value = [];
}

function selectWeekday(weekday: HomeTopicWeekday) {
  selectedWeekday.value = weekday;
}

function selectInitialWeekday(value: HomeTopicDetail) {
  const available = new Set(value.items.map(item => item.weekday));
  if (!available.size) {
    selectedWeekday.value = "MONDAY";
    return;
  }
  const today = beijingToday();
  const currentWeekday = today >= value.periodStartDate && today <= value.periodEndDate ? weekdayForDate(today) : "MONDAY";
  selectedWeekday.value = available.has(currentWeekday) ? currentWeekday : available.has("MONDAY") ? "MONDAY" : WEEKDAYS.find(day => available.has(day.weekday))!.weekday;
}

function beijingToday() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function weekdayForDate(value: string): HomeTopicWeekday {
  const [year, month, day] = value.split("-").map(Number);
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAYS[(dayIndex + 6) % 7].weekday;
}

function addDays(value: string, count: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return "";
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + count));
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[1]}.${match[2]}` : value;
}

function formatWeekRange(value: { periodStartDate: string; periodEndDate: string }) {
  return `${formatDateLabel(value.periodStartDate)} ～ ${formatDateLabel(value.periodEndDate)}`;
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
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: none;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
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
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--color-text-secondary);
  font-size: 26rpx;
  text-align: center;
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.topic-state--error {
  color: var(--color-support-action);
}

.topic-empty {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-right: var(--space-page);
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
  padding-left: var(--space-page);
}

.topic-empty::before {
  position: absolute;
  right: -180rpx;
  bottom: 80rpx;
  left: -180rpx;
  height: 300rpx;
  background: var(--page-hero-orb-bg);
  opacity: 0.34;
  transform: rotate(-14deg);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  pointer-events: none;
  content: "";
}

.topic-empty :deep(.empty-state) {
  position: relative;
  z-index: 1;
  width: 100%;
  margin-top: 48rpx;
  padding-top: 0;
  padding-bottom: 0;
}

.topic-backdrop {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
}

.topic-backdrop__image,
.topic-backdrop__blur {
  position: absolute;
  inset: 0;
}

.topic-backdrop__image--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--page-primary-fade-bg);
}

.topic-backdrop__blur {
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  filter: var(--page-backdrop-blur-filter);
  transform: scale(1.08);
}

.topic-backdrop__veil {
  position: absolute;
  inset: 0;
  opacity: 0.8;
  background: var(--page-overlay-veil-bg);
  -webkit-backdrop-filter: var(--page-overlay-veil-filter);
  backdrop-filter: var(--page-overlay-veil-filter);
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
  height: 267rpx;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.topic-summary__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
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
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.topic-chip {
  padding: 8rpx 16rpx;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
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
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 20rpx var(--space-page) 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-page) 30%, transparent);
  isolation: isolate;
}

.topic-section::before {
  content: "";
  position: absolute;
  left: -168rpx;
  top: 96rpx;
  width: 360rpx;
  height: 520rpx;
  border-radius: 50%;
  pointer-events: none;
  filter: var(--page-glow-cluster-filter);
  z-index: 0;
  opacity: 0.92;
  background: var(--page-glow-cluster-start-bg);
}

.topic-section::after {
  content: "";
  position: absolute;
  right: -176rpx;
  top: 188rpx;
  width: 360rpx;
  height: 520rpx;
  border-radius: 50%;
  pointer-events: none;
  filter: var(--page-glow-cluster-filter);
  z-index: 0;
  opacity: 0.84;
  background: var(--page-glow-cluster-end-bg);
}

.topic-section > .topic-section__head,
.topic-section > .recipe-list,
.topic-section > .history-scroll {
  position: relative;
  z-index: 1;
}

.topic-section + .topic-section {
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom))
}

.topic-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 40rpx;
}

.topic-section__title {
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: 700;
}

.topic-section__meta {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  color: var(--color-primary);
  font-size: 24rpx;
  font-weight: 700;
}

.topic-section__meta-icon {
  font-size: 26rpx;
  line-height: 1;
}

.topic-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8rpx;
}

.topic-weekdays__day {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  border-radius: var(--radius-xs);
  padding: 12rpx 2rpx;
  color: var(--color-text-secondary);
  background: var(--material-card-bg);
  font-size: 20rpx;
  line-height: 1.25;
}

.topic-weekdays__day--active {
  color: var(--color-primary);
  background: var(--page-primary-fade-bg);
  font-weight: 700;
}

.topic-weekdays__name,
.topic-weekdays__date {
  white-space: nowrap;
}

.topic-day-empty {
  padding: 52rpx 24rpx;
  color: var(--color-text-secondary);
  font-size: 24rpx;
  text-align: center;
}

.recipe-list {
  display: flex;
  flex-direction: column;
  gap: 80rpx;
}

.recipe-card {
  width: calc(100% - 36rpx);
  margin: 0 auto;
  padding-bottom: 40rpx;
  transition: transform 0.18s ease;
}

.recipe-card--reverse {
  align-self: flex-end;
}

.recipe-card--hover {
  transform: translateY(-2rpx);
}

.recipe-card__layout {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
}

.recipe-card--reverse .recipe-card__layout {
  flex-direction: row-reverse;
}

.recipe-card__rail {
  width: 184rpx;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18rpx;
  color: var(--color-text);
}

.recipe-card__part {
  letter-spacing: 4rpx;
  font-size: 18rpx;
  line-height: 1;
}

.recipe-card__sort {
  margin-top: 10rpx;
  font-size: 56rpx;
  font-weight: 500;
  line-height: 1;
}

.recipe-card__meta-group {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 18rpx;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.recipe-card__meta-pill {
  padding: 0;
  color: var(--color-text-secondary);
  font-size: 18rpx;
  line-height: 1.4;
  text-align: center;
  writing-mode: vertical-rl;
  text-orientation: upright;
  letter-spacing: 4rpx;
}

.recipe-card__content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.recipe-card__cover {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface-muted);
  box-shadow: var(--shadow-card);
}

.recipe-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-card__title {
  min-width: 0;
  flex: 1;
  color: var(--color-text);
  font-size: 34rpx;
  font-weight: 700;
  line-height: 50rpx;
}

.recipe-card__footer {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6rpx;
}

.recipe-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-width: 0;
}

.recipe-card__note {
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.recipe-card__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  height: 50rpx;
  padding: 0 10rpx;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.recipe-card__action-icon {
  font-size: 26rpx;
  line-height: 1;
}

.recipe-card__action--guide {
  color: var(--color-text-secondary);
}

.recipe-card__action--ready {
  color: var(--color-text-secondary);
}

.recipe-card__action--queued {
  color: var(--color-support-action);
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
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
  transition: transform 0.18s ease;
}

.history-card--hover {
  transform: translateY(-2rpx);
}

.history-card__cover {
  width: 100%;
  aspect-ratio: 3 / 4;
  background: var(--color-surface-muted);
}

.history-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
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

.panel-note {
  padding: 28rpx 24rpx;
  border-radius: var(--radius-xs);
  background: var(--material-card-bg);
  box-shadow: var(--material-card-shadow);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  text-align: center;
  -webkit-backdrop-filter: var(--material-card-filter);
  backdrop-filter: var(--material-card-filter);
}

.panel-note--sheet {
  margin-bottom: 12rpx;
}

.add-sheet {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding-bottom: 12rpx;
}

.add-sheet__card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
  border-radius: var(--radius-xs);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.add-sheet__cover {
  width: 144rpx;
  height: 112rpx;
  flex: 0 0 auto;
  border-radius: var(--radius-xs);
  overflow: hidden;
  background: var(--color-surface-muted);
}

.add-sheet__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-sheet__cover-text {
  color: var(--color-text-secondary);
  font-size: 22rpx;
}

.add-sheet__body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.add-sheet__title {
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.45;
}

.add-sheet__meta {
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.5;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.sheet-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.sheet-section__meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.sheet-section__title {
  color: var(--color-text);
  font-size: 32rpx;
  font-weight: var(--font-weight-semibold);
}

.sheet-section__tag {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
}

.sheet-section__action {
  color: var(--color-support-action);
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
}

.sheet-section__hint {
  color: var(--color-text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
}

.sheet-creator {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.sheet-creator__input {
  flex: 1;
  min-width: 0;
  height: 80rpx;
  line-height: 1;
  padding: 0 24rpx;
  border: 1rpx solid var(--material-input-border);
  border-radius: var(--radius-xs);
  background: var(--material-input-bg);
  box-shadow: var(--material-input-shadow);
  color: var(--color-text);
  font-size: 26rpx;
  box-sizing: border-box;
  -webkit-backdrop-filter: var(--material-input-filter);
  backdrop-filter: var(--material-input-filter);
}

.sheet-creator__button {
  flex: 0 0 auto;
  height: 80rpx;
  padding: 0 28rpx;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 80rpx;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 112rpx;
  min-height: 72rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.chip--active {
  background: var(--color-tag-primary-bg);
  color: var(--color-tag-primary-text);
  font-weight: 700;
}

.plan-queue {
  position: fixed;
  right: 28rpx;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 14rpx;
  height: 92rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  color: var(--button-primary-text);
}

.plan-queue--hover {
  opacity: 0.92;
}

.plan-queue__icon {
  line-height: 1;
  color: currentColor;
}

.plan-queue__label {
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1;
}

.plan-queue__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 10rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-mask-weak);
}

.plan-queue__badge-text {
  color: currentColor;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
}

</style>
