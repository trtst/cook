<template>
  <Layout
    title="下一餐"
    current-tab="home"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
  >
    <view class="home" :class="themeClasses">
      <view class="hero" :style="heroStyle">
        <view class="hero__copy">
          <text class="hero__eyebrow">下一餐</text>
          <text class="hero__title">今晚吃什么，先看这一屏</text>
          <text class="hero__description">不是菜谱大全，而是你家的下一餐。</text>
        </view>
        <view class="hero-scene">
          <view class="hero-scene__table" />
          <view class="hero-scene__plate">
            <view class="hero-scene__rice" />
            <view class="hero-scene__leaf hero-scene__leaf--left" />
            <view class="hero-scene__leaf hero-scene__leaf--right" />
            <view class="hero-scene__egg" />
          </view>
          <view class="hero-scene__bowl" />
        </view>
      </view>

      <view class="home-content">
        <view
          class="notice-strip"
          hover-class="notice-strip--hover"
          hover-stay-time="100"
          @click="navigateTo('/pages_meal/poll/index')"
        >
          <view class="notice-strip__icon" aria-hidden="true">
            <view class="notice-strip__megaphone">
              <view class="notice-strip__megaphone-horn" />
              <view class="notice-strip__megaphone-handle" />
            </view>
          </view>
          <text class="notice-strip__message">你还有晚餐投票未完成，截止时间 18:00</text>
        </view>

        <view class="home-board">
          <view class="entry-shell">
            <view
              class="entry-card entry-card--primary"
              hover-class="entry-card--hover"
              hover-stay-time="100"
              @click="navigateTo('/pages_meal/plan/index')"
            >
              <view class="entry-card__header">
                <text class="entry-card__mark">(</text>
                <text class="entry-card__title">今晚吃啥</text>
                <text class="entry-card__mark">)</text>
              </view>
              <text class="entry-card__subtitle">#把全家想吃的凑上</text>

              <view class="meal-photo">
                <view class="meal-photo__plate">
                  <view class="meal-photo__rice" />
                  <view class="meal-photo__leaf meal-photo__leaf--left" />
                  <view class="meal-photo__leaf meal-photo__leaf--right" />
                  <view class="meal-photo__egg" />
                </view>
                <view class="meal-photo__steam meal-photo__steam--one" />
                <view class="meal-photo__steam meal-photo__steam--two" />
              </view>

              <view class="quick-button">
                <text class="quick-button__text">开始安排</text>
                <text class="quick-button__icon">⌁</text>
              </view>
            </view>

            <view class="entry-side">
              <view
                v-for="item in sideEntries"
                :key="item.title"
                class="entry-card entry-card--side"
                :class="item.className"
                hover-class="entry-card--hover"
                hover-stay-time="100"
                @click="navigateTo(item.url)"
              >
                <text class="entry-card__side-title">{{ item.title }}</text>
                <text class="entry-card__side-subtitle">{{ item.subtitle }}</text>
                <view class="side-illustration" :class="item.illustrationClass">
                  <view class="side-illustration__body" />
                  <view class="side-illustration__accent" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="recommend-section">
          <view class="recommend-section__header">
            <text class="recommend-section__title webfont">{{ inspirationSection.title }}</text>
            <text class="recommend-section__action" @click="navigateTo(inspirationSection.moreUrl)">
              {{ inspirationSection.actionText }}
            </text>
          </view>
          <scroll-view class="inspiration-scroll" scroll-x :show-scrollbar="false" enable-flex>
            <view
              v-for="item in inspirationSection.items"
              :key="item.name"
              class="inspiration-card"
              hover-class="inspiration-card--hover"
              hover-stay-time="100"
              @click="navigateTo(item.url)"
            >
              <view class="inspiration-card__visual" :class="item.visualClass">
                <view class="inspiration-card__plate">
                  <view class="inspiration-card__food" />
                </view>
              </view>
              <text class="inspiration-card__name">{{ item.name }}</text>
              <view class="inspiration-card__meta">
                <text class="inspiration-card__scene">{{ item.scene }} / {{ item.difficulty }}</text>
                <text class="inspiration-card__time">{{ item.duration }}</text>
              </view>
            </view>
          </scroll-view>
        </view>

        <view class="recommend-section topic-section">
          <view class="recommend-section__header">
            <text class="recommend-section__title webfont">{{ topicSection.title }}</text>
            <text class="recommend-section__action" @click="navigateTo(topicSection.moreUrl)">
              {{ topicSection.actionText }}
            </text>
          </view>
          <view class="topic-list">
            <view
              v-for="item in topicSection.items"
              :key="item.title"
              class="topic-card"
              :class="item.visualClass"
              hover-class="topic-card--hover"
              hover-stay-time="100"
              @click="navigateTo(item.url)"
            >
              <view class="topic-card__art">
                <view class="topic-card__plate">
                  <view class="topic-card__food" />
                </view>
              </view>
              <view class="topic-card__content">
                <text class="topic-card__title">{{ item.title }}</text>
                <text class="topic-card__description">{{ item.description }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";

const HOME_NAV_GAP = 20;
const { navBarTotalHeight } = useSystemInfo();
const { themeClasses } = useTheme();

const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + HOME_NAV_GAP}px`
}));

const sideEntries = [
  {
    title: "我的菜谱",
    subtitle: "常吃有谱",
    url: "/pages_recipe/list/index",
    className: "entry-card--mint",
    illustrationClass: "side-illustration--book"
  },
  {
    title: "食材与采购",
    subtitle: "缺啥马上补",
    url: "/pages_pantry/index/index",
    className: "entry-card--aqua",
    illustrationClass: "side-illustration--bag"
  }
];

const inspirationSection = {
  title: "吃点什么",
  actionText: "换一批",
  moreUrl: "/pages_recipe/system/index",
  items: [
    {
      name: "鸡蛋三明治",
      scene: "早餐",
      difficulty: "简单",
      duration: "10 分钟",
      url: "/pages_recipe/detail/index",
      visualClass: "inspiration-card__visual--breakfast"
    },
    {
      name: "番茄牛腩",
      scene: "家常",
      difficulty: "中等",
      duration: "45 分钟",
      url: "/pages_recipe/detail/index",
      visualClass: "inspiration-card__visual--dinner"
    },
    {
      name: "芒果酸奶杯",
      scene: "甜品",
      difficulty: "简单",
      duration: "8 分钟",
      url: "/pages_recipe/detail/index",
      visualClass: "inspiration-card__visual--dessert"
    }
  ]
};

const topicSection = {
  title: "美食专题",
  actionText: "查看全部",
  moreUrl: "/pages_recipe/system/index",
  items: [
    {
      title: "一周晚餐不重样",
      description: "把每天的主菜先排好，少一点临时纠结。",
      url: "/pages_recipe/system/index",
      visualClass: "topic-card--warm"
    },
    {
      title: "下班 20 分钟快手菜",
      description: "适合工作日的简单搭配，快做快吃。",
      url: "/pages_recipe/system/index",
      visualClass: "topic-card--fresh"
    },
    {
      title: "冰箱剩菜再利用",
      description: "先看已有食材，把零散库存变成一餐。",
      url: "/pages_recipe/system/index",
      visualClass: "topic-card--cool"
    }
  ]
};

function navigateTo(url: string) {
  uni.navigateTo({ url });
}
</script>

<style scoped lang="scss">
.home {
  padding-bottom: var(--space-page);
}

.hero {
  position: relative;
  min-height: 650rpx;
  overflow: hidden;
  padding: 70rpx var(--space-page) 44rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(21, 27, 22, 0.16)),
    radial-gradient(circle at 20% 30%, var(--entry-side-mint-bg) 0, transparent 34%),
    radial-gradient(circle at 78% 18%, var(--entry-side-aqua-bg) 0, transparent 30%),
    linear-gradient(145deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.hero::after {
  position: absolute;
  right: -120rpx;
  bottom: -120rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  content: "";
}

.hero__copy {
  position: relative;
  z-index: 2;
  width: 430rpx;
}

.hero__eyebrow {
  display: block;
  color: var(--entry-ink);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero__title {
  display: block;
  margin-top: 18rpx;
  color: var(--entry-ink);
  font-size: var(--font-size-hero);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.hero__description {
  display: block;
  margin-top: 18rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.hero-scene {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
}

.hero-scene__table {
  position: absolute;
  right: -52rpx;
  bottom: 32rpx;
  width: 560rpx;
  height: 300rpx;
  border-radius: 96rpx 72rpx 0 0;
  background: rgba(255, 255, 255, 0.3);
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.42);
  transform: rotate(-4deg);
}

.hero-scene__plate {
  position: absolute;
  right: 86rpx;
  bottom: 124rpx;
  width: 220rpx;
  height: 148rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  box-shadow: 0 18rpx 38rpx rgba(41, 56, 44, 0.12);
  transform: rotate(-8deg);
}

.hero-scene__rice {
  position: absolute;
  top: 36rpx;
  left: 70rpx;
  width: 84rpx;
  height: 62rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -40rpx 14rpx 0 var(--entry-food-orange),
    44rpx 10rpx 0 var(--entry-food-green),
    4rpx 48rpx 0 var(--entry-food-yellow);
}

.hero-scene__leaf {
  position: absolute;
  width: 72rpx;
  height: 32rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-leaf-left);
}

.hero-scene__leaf--left {
  top: -12rpx;
  left: 24rpx;
  transform: rotate(-28deg);
}

.hero-scene__leaf--right {
  right: 20rpx;
  bottom: 12rpx;
  background: var(--entry-leaf-right);
  transform: rotate(-20deg);
}

.hero-scene__egg {
  position: absolute;
  top: 54rpx;
  right: 52rpx;
  width: 48rpx;
  height: 48rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-egg-bg);
}

.hero-scene__bowl {
  position: absolute;
  right: 320rpx;
  bottom: 86rpx;
  width: 142rpx;
  height: 98rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 30rpx 30rpx 72rpx 72rpx;
  background: var(--entry-side-aqua-bg);
  box-shadow: 0 18rpx 36rpx rgba(41, 56, 44, 0.12);
  transform: rotate(7deg);
}

.home-content {
  position: relative;
  z-index: 2;
  margin-top: -70rpx;
  padding: 24rpx var(--space-page) 0;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--color-page);
}

.home-board {
  padding: 20rpx;
  border-radius: var(--entry-board-radius);
  background: var(--entry-board-bg);
  box-shadow: var(--entry-board-shadow);
  -webkit-backdrop-filter: var(--entry-board-backdrop-filter);
  backdrop-filter: var(--entry-board-backdrop-filter);
}

.entry-shell {
  display: flex;
}

.entry-card {
  position: relative;
  overflow: hidden;
  border: var(--entry-card-border);
  border-radius: var(--entry-card-radius);
  -webkit-backdrop-filter: var(--entry-card-backdrop-filter);
  backdrop-filter: var(--entry-card-backdrop-filter);
}

.entry-card--hover,
.notice-strip--hover {
  opacity: 0.88;
}

.entry-card--primary {
  width: 62%;
  min-height: 464rpx;
  padding: 34rpx 28rpx 28rpx;
  background: var(--entry-primary-bg);
}

.entry-card--primary::after {
  position: absolute;
  right: -44rpx;
  bottom: -50rpx;
  width: 190rpx;
  height: 190rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.24);
  content: "";
}

.entry-side {
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-left: 20rpx;
}

.entry-card--side {
  min-height: 222rpx;
  padding: 34rpx 28rpx;
}

.entry-card--side + .entry-card--side {
  margin-top: 20rpx;
}

.entry-card--mint {
  background: var(--entry-side-mint-bg);
}

.entry-card--aqua {
  background: var(--entry-side-aqua-bg);
}

.entry-card__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.entry-card__mark {
  color: var(--entry-accent);
  font-size: 40rpx;
  font-weight: var(--entry-title-weight);
  line-height: 1;
}

.entry-card__title {
  color: var(--entry-ink);
  font-size: 34rpx;
  font-weight: var(--entry-title-weight);
  line-height: 1.15;
}

.entry-card__subtitle {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 10rpx;
  color: var(--entry-muted-text);
  font-size: 22rpx;
  font-weight: var(--entry-subtitle-weight);
}

.entry-card__side-title {
  position: relative;
  z-index: 1;
  display: block;
  color: var(--entry-ink);
  font-size: 32rpx;
  font-weight: var(--entry-title-weight);
  line-height: 1.2;
}

.entry-card__side-subtitle {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 12rpx;
  color: var(--entry-side-muted-text);
  font-size: 22rpx;
  font-weight: var(--entry-subtitle-weight);
}

.meal-photo {
  position: absolute;
  right: 28rpx;
  bottom: 76rpx;
  left: 28rpx;
  height: 218rpx;
  border-radius: var(--radius-md);
  background: var(--entry-photo-bg);
  box-shadow: var(--entry-photo-shadow);
}

.meal-photo__plate {
  position: absolute;
  top: 42rpx;
  left: 50%;
  width: 190rpx;
  height: 126rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: translateX(-50%) rotate(-6deg);
}

.meal-photo__rice {
  position: absolute;
  top: 28rpx;
  left: 60rpx;
  width: 72rpx;
  height: 54rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -34rpx 10rpx 0 var(--entry-food-orange),
    38rpx 8rpx 0 var(--entry-food-green),
    4rpx 42rpx 0 var(--entry-food-yellow);
}

.meal-photo__leaf {
  position: absolute;
  width: 64rpx;
  height: 28rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-leaf-left);
}

.meal-photo__leaf--left {
  top: -10rpx;
  left: 18rpx;
  transform: rotate(-28deg);
}

.meal-photo__leaf--right {
  right: 14rpx;
  bottom: 6rpx;
  background: var(--entry-leaf-right);
  transform: rotate(-20deg);
}

.meal-photo__egg {
  position: absolute;
  top: 44rpx;
  right: 42rpx;
  width: 42rpx;
  height: 42rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-egg-bg);
}

.meal-photo__steam {
  position: absolute;
  top: 26rpx;
  width: 8rpx;
  height: 48rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-outline);
}

.meal-photo__steam--one {
  left: 54rpx;
  transform: rotate(20deg);
}

.meal-photo__steam--two {
  right: 58rpx;
  transform: rotate(-22deg);
}

.quick-button {
  position: absolute;
  right: 54rpx;
  bottom: 38rpx;
  left: 54rpx;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 70rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
  box-shadow: var(--entry-button-shadow);
}

.quick-button__text {
  color: var(--entry-button-color);
  font-size: 26rpx;
  font-weight: 700;
}

.quick-button__icon {
  margin-left: 10rpx;
  color: var(--entry-button-color);
  font-size: 30rpx;
  font-weight: 700;
}

.side-illustration {
  position: absolute;
  right: 22rpx;
  bottom: 18rpx;
  width: 92rpx;
  height: 92rpx;
}

.side-illustration__body {
  position: absolute;
  right: 8rpx;
  bottom: 4rpx;
  width: 68rpx;
  height: 58rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 16rpx;
  background: var(--entry-photo-bg);
  transform: rotate(-8deg);
}

.side-illustration__accent {
  position: absolute;
  top: 4rpx;
  right: 6rpx;
  width: 30rpx;
  height: 30rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-accent);
  box-shadow: -26rpx 24rpx 0 -2rpx var(--entry-primary-bg);
}

.side-illustration--book .side-illustration__body {
  width: 66rpx;
  height: 76rpx;
  border-radius: 34rpx 34rpx 18rpx 18rpx;
}

.side-illustration--bag .side-illustration__body::after {
  position: absolute;
  top: 22rpx;
  left: 16rpx;
  width: 34rpx;
  height: 22rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-top: 0;
  border-right: 0;
  content: "";
  transform: rotate(-10deg);
}

.side-illustration--bag .side-illustration__accent {
  top: 8rpx;
  right: 46rpx;
  width: 34rpx;
  height: 20rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-food-green);
  box-shadow: 28rpx 16rpx 0 -2rpx var(--entry-leaf-right);
}

.notice-strip {
  display: flex;
  align-items: center;
  min-height: 104rpx;
  margin-bottom: 20rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: 0 6rpx 18rpx rgba(23, 35, 29, 0.04);
}

.notice-strip__icon {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  margin-right: 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(50, 111, 168, 0.1);
}

.notice-strip__megaphone {
  position: relative;
  width: 42rpx;
  height: 42rpx;
  transform: rotate(-12deg);
}

.notice-strip__megaphone::before {
  position: absolute;
  top: 8rpx;
  left: 4rpx;
  width: 15rpx;
  height: 15rpx;
  border: 4rpx solid #2e8be8;
  border-radius: 50%;
  background: #ffffff;
  content: "";
}

.notice-strip__megaphone::after {
  position: absolute;
  top: 3rpx;
  right: 2rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--entry-food-yellow);
  box-shadow:
    -6rpx -5rpx 0 -1rpx var(--entry-food-yellow),
    5rpx 8rpx 0 -2rpx var(--entry-accent);
  content: "";
}

.notice-strip__megaphone-horn {
  position: absolute;
  top: 12rpx;
  left: 18rpx;
  width: 22rpx;
  height: 16rpx;
  border-radius: 5rpx 12rpx 12rpx 5rpx;
  background: linear-gradient(90deg, #3f8cff, #68cdf9);
}

.notice-strip__megaphone-handle {
  position: absolute;
  top: 25rpx;
  left: 16rpx;
  width: 9rpx;
  height: 15rpx;
  border-radius: 5rpx;
  background: #2267c7;
  transform: rotate(18deg);
}

.notice-strip__message {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-section {
  margin-top: 34rpx;
}

.recommend-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.recommend-section__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.recommend-section__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.inspiration-scroll {
  width: 100%;
  white-space: nowrap;
}

.inspiration-card {
  display: inline-block;
  width: 212rpx;
  margin-right: 18rpx;
  vertical-align: top;
}

.inspiration-card--hover,
.topic-card--hover {
  opacity: 0.88;
}

.inspiration-card__visual {
  position: relative;
  overflow: hidden;
  height: 286rpx;
  border-radius: var(--radius-card);
  background: var(--entry-board-bg);
}

.inspiration-card__visual::after {
  position: absolute;
  right: -52rpx;
  bottom: -42rpx;
  width: 154rpx;
  height: 154rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  content: "";
}

.inspiration-card__visual--breakfast {
  background: linear-gradient(145deg, #fff3bf, var(--entry-board-bg));
}

.inspiration-card__visual--dinner {
  background: linear-gradient(145deg, var(--entry-primary-bg), #ffe5b2);
}

.inspiration-card__visual--dessert {
  background: linear-gradient(145deg, #ffe1ef, #f7edff);
}

.inspiration-card__plate {
  position: absolute;
  right: 28rpx;
  bottom: 56rpx;
  width: 148rpx;
  height: 104rpx;
  border: 6rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: rotate(-8deg);
}

.inspiration-card__food {
  position: absolute;
  top: 28rpx;
  left: 50rpx;
  width: 48rpx;
  height: 38rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -28rpx 8rpx 0 var(--entry-food-orange),
    30rpx 8rpx 0 var(--entry-food-green),
    2rpx 30rpx 0 var(--entry-food-yellow);
}

.inspiration-card__name {
  display: block;
  overflow: hidden;
  margin-top: 14rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspiration-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10rpx;
}

.inspiration-card__scene,
.inspiration-card__time {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-tight);
}

.inspiration-card__scene {
  overflow: hidden;
  max-width: 132rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspiration-card__time {
  flex: 0 0 auto;
  margin-left: 10rpx;
}

.topic-section {
  padding-bottom: 8rpx;
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.topic-card {
  position: relative;
  overflow: hidden;
  width: 100%;
  padding-bottom: 22rpx;
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.topic-card--warm {
  background: linear-gradient(135deg, #fff1cf, #fff8ea);
}

.topic-card--fresh {
  background: linear-gradient(135deg, #dcf7e7, #fffdf8);
}

.topic-card--cool {
  background: linear-gradient(135deg, #dff3ff, #fffdf8);
}

.topic-card__content {
  position: relative;
  z-index: 1;
  min-width: 0;
  padding: 22rpx 24rpx 0;
}

.topic-card__title,
.topic-card__description {
  display: block;
}

.topic-card__title {
  color: var(--entry-ink);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.topic-card__description {
  margin-top: 10rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  white-space: normal;
}

.topic-card__art {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 306rpx;
  border-radius: var(--radius-card) var(--radius-card) 0 0;
}

.topic-card__art::after {
  position: absolute;
  right: -70rpx;
  bottom: -80rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  content: "";
}

.topic-card__plate {
  position: absolute;
  right: 78rpx;
  bottom: 74rpx;
  width: 210rpx;
  height: 138rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: rotate(8deg);
}

.topic-card__food {
  position: absolute;
  top: 38rpx;
  left: 72rpx;
  width: 62rpx;
  height: 48rpx;
  border-radius: 50%;
  background: var(--entry-food-yellow);
  box-shadow:
    -42rpx 12rpx 0 var(--entry-food-green),
    44rpx 10rpx 0 var(--entry-food-orange),
    0 42rpx 0 var(--entry-food-rice);
}
</style>
