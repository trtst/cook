<template>
  <Layout
    title=""
    current-tab="home"
    :show-left="false"
    full-screen
    :navbar-placeholder="false"
    navbar-transparent
  >
    <template #navbar-left>
      <view class="table-nav__selector" hover-class="table-nav__selector--hover" hover-stay-time="100" @click="navigateTo('/pages_restaurant/switch/index')">
        <text class="restaurant-bar__label">当前饭桌</text>
        <text class="restaurant-bar__name">{{ restaurantName }}</text>
      </view>
    </template>
    <view class="table-page" :class="themeClasses">
      <view class="table-hero" :style="heroStyle">
        <view class="hero-main">
          <view class="hero-copy">
            <text class="hero-copy__eyebrow">{{ memberCountText }}</text>
            <text class="hero-copy__title">{{ heroTitle }}</text>
            <text class="hero-copy__description">{{ heroDescription }}</text>
          </view>

          <view class="table-scene">
            <view class="table-scene__cloth" />
            <view class="table-scene__plate">
              <view class="table-scene__rice" />
              <view class="table-scene__leaf table-scene__leaf--left" />
              <view class="table-scene__leaf table-scene__leaf--right" />
              <view class="table-scene__egg" />
            </view>
            <view class="table-scene__bowl" />
            <view class="table-scene__cup" />
          </view>
        </view>
      </view>

      <view class="table-content">
        <view class="feature-board">
          <view class="feature-card feature-card--main" hover-class="feature-card--hover" hover-stay-time="100" @click="navigateTo('/pages_meal/plan/index')">
            <view class="feature-card__copy">
              <text class="feature-card__title">饭局</text>
              <text class="feature-card__subtitle">今晚吃啥先定个方向</text>
            </view>
            <view class="feature-card__art feature-card__art--meal">
              <view class="feature-card__plate">
                <view class="feature-card__food" />
              </view>
            </view>
          </view>

          <view class="feature-side">
            <view class="feature-card feature-card--side feature-card--mint" hover-class="feature-card--hover" hover-stay-time="100" @click="navigateTo('/pages_restaurant/members/index')">
              <text class="feature-card__title">成员</text>
              <text class="feature-card__subtitle">一起吃饭的人</text>
              <view class="feature-card__mini feature-card__mini--members">
                <text class="feature-card__mini-text">4</text>
              </view>
            </view>

            <view class="feature-card feature-card--side feature-card--green" hover-class="feature-card--hover" hover-stay-time="100" @click="navigateTo('/pages_recipe/list/index')">
              <text class="feature-card__title">常吃</text>
              <text class="feature-card__subtitle">顺手复做</text>
              <view class="feature-card__mini feature-card__mini--recipe">
                <view class="feature-card__mini-dot" />
              </view>
            </view>
          </view>
        </view>

        <view class="action-dock">
          <view
            v-for="item in quickActions"
            :key="item.title"
            class="dock-action"
            hover-class="dock-action--hover"
            hover-stay-time="100"
            @click="navigateTo(item.url)"
          >
            <view class="dock-action__icon" :class="item.className">
              <image class="dock-action__image" :src="item.iconSrc" mode="aspectFit" />
            </view>
            <text class="dock-action__title">{{ item.title }}</text>
          </view>
        </view>

        <view v-if="hasMealPlan" class="decision-card" hover-class="decision-card--hover" hover-stay-time="100" @click="navigateTo('/pages_meal/plan/index')">
          <view class="decision-card__header">
            <view>
              <text class="decision-card__label">饭局安排</text>
              <text class="decision-card__title">先把今晚定下来</text>
            </view>
            <view class="decision-card__badge">
              <text class="decision-card__badge-text">征集中</text>
            </view>
          </view>

          <view class="candidate-list">
            <view v-for="item in mealCandidates" :key="item.name" class="candidate-item">
              <view class="candidate-item__rank">
                <text class="candidate-item__rank-text">{{ item.rank }}</text>
              </view>
              <view class="candidate-item__main">
                <text class="candidate-item__name">{{ item.name }}</text>
                <text class="candidate-item__meta">{{ item.meta }}</text>
              </view>
              <text class="candidate-item__votes">{{ item.votes }}</text>
            </view>
          </view>

          <view class="decision-progress">
            <view class="decision-progress__track">
              <view class="decision-progress__value" />
            </view>
            <text class="decision-progress__text">2/4 已表态</text>
          </view>

          <view class="decision-card__footer">
            <text class="decision-card__hint">18:00 前确认，确认后自动看缺什么</text>
            <text class="decision-card__action">去确认</text>
          </view>
        </view>

        <view class="table-section">
          <view class="section-heading">
            <text class="section-heading__title">饭桌动静</text>
            <text class="section-heading__action" @click="navigateTo('/pages_meal/poll/index')">全部</text>
          </view>
          <view class="family-feed">
            <view v-for="item in familyFeed" :key="item.title" class="feed-item">
              <view class="feed-item__avatar" :class="item.avatarClass">
                <text class="feed-item__avatar-text">{{ item.avatar }}</text>
              </view>
              <view class="feed-item__content">
                <text class="feed-item__title">{{ item.title }}</text>
                <text class="feed-item__description">{{ item.description }}</text>
              </view>
              <text class="feed-item__time">{{ item.time }}</text>
            </view>
          </view>
        </view>

        <view class="pantry-panel">
          <view class="pantry-panel__header">
            <view>
              <text class="pantry-panel__label">买菜和冰箱</text>
              <text class="pantry-panel__title">今晚还差 3 样</text>
            </view>
            <text class="pantry-panel__action" @click="navigateTo('/pages_pantry/list/index')">去买菜</text>
          </view>

          <view class="pantry-list">
            <view v-for="item in pantryItems" :key="item.name" class="pantry-item">
              <view class="pantry-item__dot" :class="item.className" />
              <text class="pantry-item__name">{{ item.name }}</text>
              <text class="pantry-item__state">{{ item.state }}</text>
            </view>
          </view>
        </view>

        <view class="table-section table-section--recipes">
          <view class="section-heading">
              <text class="section-heading__title">常吃清单</text>
            <text class="section-heading__action" @click="navigateTo('/pages_recipe/list/index')">菜谱</text>
          </view>
          <scroll-view class="recipe-scroll" scroll-x :show-scrollbar="false" enable-flex>
            <view
              v-for="item in familyRecipes"
              :key="item.name"
              class="family-recipe"
              hover-class="family-recipe--hover"
              hover-stay-time="100"
              @click="navigateTo('/pages_recipe/detail/index')"
            >
              <view class="family-recipe__visual" :class="item.visualClass">
                <view class="family-recipe__plate">
                  <view class="family-recipe__food" />
                </view>
              </view>
              <text class="family-recipe__name">{{ item.name }}</text>
              <text class="family-recipe__meta">{{ item.meta }}</text>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import askIcon from "@/assets/home-actions/ask.svg";
import gapIcon from "@/assets/home-actions/gap.svg";
import randomIcon from "@/assets/home-actions/random.svg";
import wishIcon from "@/assets/home-actions/wish.svg";
import { useSystemInfo } from "@/composables/useSystemInfo";
import { useTheme } from "@/composables/useTheme";
import { useRestaurantStore } from "@/stores/restaurant";

const HOME_NAV_GAP = 16;
const { navBarTotalHeight } = useSystemInfo();
const { themeClasses } = useTheme();
const restaurantStore = useRestaurantStore();

const heroStyle = computed(() => ({
  paddingTop: `${navBarTotalHeight.value + HOME_NAV_GAP}px`
}));

const restaurantName = computed(() => restaurantStore.currentRestaurant?.name ?? "我的饭桌");
const memberCountText = computed(() => {
  const count = restaurantStore.currentRestaurant?.memberCount ?? 4;
  return `${count} 人饭桌`;
});
const hasMealPlan = false;

const heroTitle = computed(() => (hasMealPlan ? "今晚 18:30 开饭" : "今晚谁来定菜？"));
const heroDescription = computed(() =>
  hasMealPlan ? "3 道候选菜，2 人已表态，还有成员没确认。" : "还没安排饭局，先记想吃或发起点菜。"
);

const mealCandidates = [
  { rank: "1", name: "番茄牛腩", meta: "成员想吃 · 45 分钟", votes: "2 票" },
  { rank: "2", name: "青椒炒蛋", meta: "有人推荐 · 快手菜", votes: "1 票" },
  { rank: "3", name: "菌菇鸡汤", meta: "周末常做 · 适合配饭", votes: "待定" }
];

const quickActions = [
  {
    title: "我想吃",
    subtitle: "先记一口",
    iconSrc: wishIcon,
    url: "/pages_meal/wish/index",
    className: "quick-action--primary"
  },
  {
    title: "问大家",
    subtitle: "问问大家",
    iconSrc: askIcon,
    url: "/pages_meal/poll/index",
    className: "quick-action--mint"
  },
  {
    title: "随机",
    subtitle: "不纠结",
    iconSrc: randomIcon,
    url: "/pages_meal/random/index",
    className: "quick-action--aqua"
  },
  {
    title: "缺什么",
    subtitle: "买菜前看",
    iconSrc: gapIcon,
    url: "/pages_pantry/gap/index",
    className: "quick-action--soft"
  }
];

const familyFeed = [
  {
    avatar: "A",
    title: "有人想吃番茄牛腩",
    description: "顺手补一点香菜，今晚就能做。",
    time: "刚刚",
    avatarClass: "feed-item__avatar--rose"
  },
  {
    avatar: "B",
    title: "有人投了青椒炒蛋",
    description: "工作日简单点，十几分钟能上桌。",
    time: "8 分钟",
    avatarClass: "feed-item__avatar--green"
  },
  {
    avatar: "我",
    title: "购物清单新增 5 项",
    description: "牛腩、番茄、鸡蛋、菌菇和酸奶。",
    time: "今天",
    avatarClass: "feed-item__avatar--blue"
  }
];

const pantryItems = [
  { name: "牛腩", state: "待买", className: "pantry-item__dot--danger" },
  { name: "番茄", state: "待买", className: "pantry-item__dot--warning" },
  { name: "鸡蛋", state: "够用", className: "pantry-item__dot--ok" }
];

const familyRecipes = [
  {
    name: "番茄牛腩",
    meta: "上次 6 天前",
    visualClass: "family-recipe__visual--warm"
  },
  {
    name: "青椒炒蛋",
    meta: "快手常备",
    visualClass: "family-recipe__visual--fresh"
  },
  {
    name: "菌菇鸡汤",
    meta: "周末适合",
    visualClass: "family-recipe__visual--cool"
  }
];

function navigateTo(url: string) {
  uni.navigateTo({ url });
}
</script>

<style scoped lang="scss">
.table-page {
  min-height: 100vh;
  padding-bottom: var(--space-page);
}

.table-hero {
  position: relative;
  overflow: hidden;
  min-height: 560rpx;
  padding: 64rpx var(--space-page) 200rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(21, 27, 22, 0.1)),
    radial-gradient(circle at 18% 26%, var(--entry-side-mint-bg) 0, transparent 30%),
    radial-gradient(circle at 84% 18%, var(--entry-side-aqua-bg) 0, transparent 28%),
    linear-gradient(145deg, var(--entry-primary-bg), var(--entry-board-bg));
}

.table-hero::before {
  position: absolute;
  right: -42%;
  bottom: -2rpx;
  left: -42%;
  z-index: 3;
  height: 300rpx;
  background:
    radial-gradient(
      100% 120% at 50% -30%,
      transparent 46%,
      var(--color-surface-mask-weak) 53%,
      var(--color-surface-mask-medium) 62%,
      var(--color-surface-mask-strong) 75%,
      var(--color-surface) 90%
    );
  content: "";
  pointer-events: none;
}

.table-hero::after {
  position: absolute;
  right: -144rpx;
  bottom: -138rpx;
  width: 390rpx;
  height: 390rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.22);
  content: "";
}

.table-nav__selector {
  min-width: 0;
}

.table-nav__selector--hover,
.decision-card--hover,
.feature-card--hover,
.dock-action--hover,
.family-recipe--hover {
  opacity: 0.86;
}

.restaurant-bar__label,
.restaurant-bar__name,
.hero-copy__eyebrow,
.hero-copy__title,
.hero-copy__description {
  display: block;
}

.restaurant-bar__label {
  color: var(--entry-muted-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.restaurant-bar__name {
  overflow: hidden;
  max-width: 420rpx;
  margin-top: 8rpx;
  color: var(--entry-ink);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-main {
  position: relative;
  z-index: 2;
  min-height: 330rpx;
  margin-top: 30rpx;
}

.hero-copy {
  position: relative;
  z-index: 2;
  width: 420rpx;
}

.hero-copy__eyebrow {
  color: var(--entry-ink);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero-copy__title {
  margin-top: 18rpx;
  color: var(--entry-ink);
  font-size: 58rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1.04;
}

.hero-copy__description {
  margin-top: 20rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.table-scene {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.table-scene__cloth {
  position: absolute;
  right: -60rpx;
  bottom: -2rpx;
  width: 536rpx;
  height: 266rpx;
  border-radius: 92rpx 72rpx 0 0;
  background: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1rpx rgba(255, 255, 255, 0.42);
  transform: rotate(-4deg);
}

.table-scene__plate {
  position: absolute;
  right: 80rpx;
  bottom: 82rpx;
  width: 206rpx;
  height: 138rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  box-shadow: 0 18rpx 38rpx rgba(41, 56, 44, 0.12);
  transform: rotate(-8deg);
}

.table-scene__rice {
  position: absolute;
  top: 34rpx;
  left: 66rpx;
  width: 78rpx;
  height: 58rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -38rpx 12rpx 0 var(--entry-food-orange),
    42rpx 10rpx 0 var(--entry-food-green),
    4rpx 44rpx 0 var(--entry-food-yellow);
}

.table-scene__leaf {
  position: absolute;
  width: 68rpx;
  height: 30rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-leaf-left);
}

.table-scene__leaf--left {
  top: -12rpx;
  left: 22rpx;
  transform: rotate(-28deg);
}

.table-scene__leaf--right {
  right: 18rpx;
  bottom: 10rpx;
  background: var(--entry-leaf-right);
  transform: rotate(-20deg);
}

.table-scene__egg {
  position: absolute;
  top: 50rpx;
  right: 48rpx;
  width: 46rpx;
  height: 46rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-egg-bg);
}

.table-scene__bowl {
  position: absolute;
  right: 306rpx;
  bottom: 54rpx;
  width: 128rpx;
  height: 88rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 28rpx 28rpx 68rpx 68rpx;
  background: var(--entry-side-aqua-bg);
  box-shadow: 0 18rpx 36rpx rgba(41, 56, 44, 0.12);
  transform: rotate(7deg);
}

.table-scene__cup {
  position: absolute;
  right: 40rpx;
  bottom: 56rpx;
  width: 66rpx;
  height: 78rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: 18rpx 18rpx 28rpx 28rpx;
  background: var(--entry-side-mint-bg);
  transform: rotate(-10deg);
}

.table-content {
  position: relative;
  z-index: 3;
  margin-top: -200rpx;
  padding: 50rpx var(--space-page) 28rpx;
}

.feature-board {
  display: flex;
  gap: 14rpx;
}

.feature-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--entry-card-radius);
}

.feature-card--main {
  flex: 1 1 0;
  min-height: 292rpx;
  padding: 24rpx 22rpx;
  background: var(--entry-primary-bg);
}

.feature-side {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 14rpx;
}

.feature-card--side {
  flex: 1;
  min-height: 139rpx;
  padding: 20rpx 18rpx;
}

.feature-card--mint {
  background: var(--entry-side-mint-bg);
}

.feature-card--green {
  background: var(--entry-side-aqua-bg);
}

.feature-card__title,
.feature-card__subtitle {
  position: relative;
  z-index: 2;
  display: block;
}

.feature-card__title {
  color: var(--entry-ink);
  font-size: 28rpx;
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.feature-card__subtitle {
  margin-top: 8rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-normal);
}

.feature-card__art {
  position: absolute;
  right: 22rpx;
  bottom: 44rpx;
  left: 22rpx;
  height: 132rpx;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 1rpx rgba(20, 20, 20, 0.03);
}

.feature-card__plate {
  position: absolute;
  top: 30rpx;
  left: 50%;
  width: 132rpx;
  height: 88rpx;
  border: 5rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: translateX(-50%) rotate(-6deg);
}

.feature-card__food {
  position: absolute;
  top: 22rpx;
  left: 42rpx;
  width: 48rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--entry-food-rice);
  box-shadow:
    -24rpx 8rpx 0 var(--entry-food-orange),
    26rpx 7rpx 0 var(--entry-food-green),
    3rpx 28rpx 0 var(--entry-food-yellow);
}

.feature-card__mini {
  position: absolute;
  right: 18rpx;
  bottom: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  border: 5rpx solid var(--entry-outline);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.86);
  transform: rotate(-7deg);
}

.feature-card__mini--members {
  border-radius: var(--radius-pill);
}

.feature-card__mini-text {
  color: var(--entry-ink);
  font-size: 24rpx;
  font-weight: var(--font-weight-heavy);
}

.feature-card__mini-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-food-yellow);
  box-shadow: 12rpx -12rpx 0 -3rpx var(--entry-accent);
}

.action-dock {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  margin-top: 32rpx;
}

.dock-action {
  display: flex;
  align-items: center;
  flex-direction: column;
  min-width: 0;
}

.dock-action__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 20rpx;
  box-shadow: 0 10rpx 22rpx rgba(41, 56, 44, 0.1);
}

.dock-action__icon.quick-action--primary {
  background: var(--entry-primary-bg);
}

.dock-action__icon.quick-action--mint {
  background: var(--entry-side-mint-bg);
}

.dock-action__icon.quick-action--aqua {
  background: var(--entry-side-aqua-bg);
}

.dock-action__icon.quick-action--soft {
  background: var(--color-surface-muted);
}

.dock-action__image {
  width: 54rpx;
  height: 54rpx;
}

.dock-action__title {
  display: block;
  margin-top: 12rpx;
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
  text-align: center;
}

.decision-card,
.table-section,
.pantry-panel {
  box-shadow: var(--shadow-card);
}

.decision-card {
  overflow: hidden;
  padding: 30rpx;
  border-radius: var(--entry-board-radius);
  background: var(--entry-board-bg);
}

.decision-card__header,
.decision-card__footer,
.decision-progress,
.pantry-panel__header,
.pantry-item {
  display: flex;
}

.decision-card__header {
  align-items: flex-start;
  justify-content: space-between;
}

.decision-card__label,
.decision-card__title,
.decision-card__hint,
.decision-card__action {
  display: block;
}

.decision-card__label {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.decision-card__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: 40rpx;
  font-weight: var(--font-weight-heavy);
  line-height: 1.2;
}

.decision-card__badge {
  flex: 0 0 auto;
  padding: 12rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
}

.decision-card__badge-text {
  color: var(--color-primary-active);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 28rpx;
}

.candidate-item {
  display: flex;
  align-items: center;
  min-height: 86rpx;
  padding: 14rpx 16rpx;
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.candidate-item__rank {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
}

.candidate-item__rank-text {
  color: var(--entry-button-color);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-heavy);
}

.candidate-item__main {
  min-width: 0;
  margin-left: 16rpx;
}

.candidate-item__name,
.candidate-item__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-item__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.candidate-item__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.candidate-item__votes {
  flex: 0 0 auto;
  margin-left: 14rpx;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.decision-progress {
  align-items: center;
  margin-top: 24rpx;
}

.decision-progress__track {
  overflow: hidden;
  flex: 1;
  height: 12rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.decision-progress__value {
  width: 50%;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
}

.decision-progress__text {
  flex: 0 0 auto;
  margin-left: 16rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.decision-card__footer {
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid var(--color-divider);
}

.decision-card__hint {
  min-width: 0;
  padding-right: 20rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}

.decision-card__action {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.table-section,
.pantry-panel {
  margin-top: 28rpx;
  padding: 28rpx;
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.section-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
}

.section-heading__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.family-feed {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.feed-item {
  display: flex;
  align-items: center;
}

.feed-item__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  border-radius: var(--radius-pill);
}

.feed-item__avatar--rose {
  background: #ffe1ef;
}

.feed-item__avatar--green {
  background: #dcf7e7;
}

.feed-item__avatar--blue {
  background: #dff3ff;
}

.feed-item__avatar-text {
  color: var(--entry-ink);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.feed-item__content {
  min-width: 0;
  margin-left: 18rpx;
}

.feed-item__title,
.feed-item__description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-item__title {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.feed-item__description {
  max-width: 430rpx;
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.feed-item__time {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.pantry-panel {
  background: linear-gradient(135deg, var(--entry-side-aqua-bg), var(--color-surface));
}

.pantry-panel__header {
  align-items: flex-start;
  justify-content: space-between;
}

.pantry-panel__label,
.pantry-panel__title,
.pantry-panel__action {
  display: block;
}

.pantry-panel__label {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.pantry-panel__title {
  margin-top: 10rpx;
  color: var(--color-text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
  line-height: var(--line-height-tight);
}

.pantry-panel__action {
  flex: 0 0 auto;
  padding: 14rpx 22rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
  color: var(--entry-button-color);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.pantry-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 24rpx;
}

.pantry-item {
  align-items: center;
  min-height: 72rpx;
  padding: 0 18rpx;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.56);
}

.pantry-item__dot {
  flex: 0 0 auto;
  width: 16rpx;
  height: 16rpx;
  border-radius: var(--radius-pill);
}

.pantry-item__dot--danger {
  background: var(--entry-food-orange);
}

.pantry-item__dot--warning {
  background: var(--entry-food-yellow);
}

.pantry-item__dot--ok {
  background: var(--entry-food-green);
}

.pantry-item__name {
  min-width: 0;
  margin-left: 16rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.pantry-item__state {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.table-section--recipes {
  padding-right: 0;
}

.recipe-scroll {
  width: 100%;
  white-space: nowrap;
}

.family-recipe {
  display: inline-block;
  width: 204rpx;
  margin-right: 18rpx;
  vertical-align: top;
}

.family-recipe__visual {
  position: relative;
  overflow: hidden;
  height: 220rpx;
  border-radius: var(--radius-card);
  background: var(--entry-board-bg);
}

.family-recipe__visual--warm {
  background: linear-gradient(145deg, var(--entry-primary-bg), #ffe5b2);
}

.family-recipe__visual--fresh {
  background: linear-gradient(145deg, #dcf7e7, var(--entry-board-bg));
}

.family-recipe__visual--cool {
  background: linear-gradient(145deg, #dff3ff, var(--entry-board-bg));
}

.family-recipe__plate {
  position: absolute;
  right: 24rpx;
  bottom: 50rpx;
  width: 148rpx;
  height: 104rpx;
  border: 6rpx solid var(--entry-outline);
  border-radius: 50%;
  background: var(--entry-photo-plate-bg);
  transform: rotate(-8deg);
}

.family-recipe__food {
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

.family-recipe__name,
.family-recipe__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.family-recipe__name {
  margin-top: 14rpx;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.family-recipe__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}
</style>
