<template>
  <Layout title="我的" current-tab="me" :show-left="false">
    <view class="me-page" :class="themeClasses">
      <template v-if="profileLoading">
        <view class="me-skeleton">
          <view class="profile-card">
            <Skeleton class="profile-card__avatar-skeleton" shape="circle" width="112rpx" height="112rpx" />
            <view class="profile-card__main">
              <Skeleton width="260rpx" height="36rpx" />
              <Skeleton width="360rpx" height="28rpx" />
            </view>
          </view>
          <Skeleton layout="column" :count="3" width="100%" height="118rpx" radius="var(--radius-lg)" />
          <Skeleton width="100%" height="260rpx" radius="var(--entry-board-radius)" />
        </view>
      </template>

      <template v-else>
        <Login
          v-if="!sessionStore.isLoggedIn"
          class="login-card"
          title="登录后查看我的餐厅"
          description="登录后可以查看账号、餐厅列表、成员身份和设置。"
          @success="loadMe"
        />

        <view v-else class="profile-card">
          <view class="profile-card__avatar">
            <text class="profile-card__avatar-text">我</text>
          </view>
          <view class="profile-card__main">
            <text class="profile-card__name">下一餐用户</text>
            <text class="profile-card__meta">当前账号 {{ sessionStore.userId || "已登录" }}</text>
          </view>
          <view class="profile-card__action" hover-class="profile-card__action--hover" hover-stay-time="100" @click="loadMe">
            <text class="profile-card__action-text">刷新</text>
          </view>
        </view>

        <view v-if="sessionStore.isLoggedIn" class="restaurant-panel">
          <view class="section-heading">
            <text class="section-heading__title">当前餐厅</text>
            <text class="section-heading__action" @click="navigateTo('/pages_restaurant/switch/index')">切换</text>
          </view>

          <view v-if="restaurantStore.currentRestaurant" class="restaurant-card">
            <text class="restaurant-card__name">{{ restaurantStore.currentRestaurant.name }}</text>
            <text class="restaurant-card__meta">共 {{ restaurantCount }} 个餐厅 · 当前身份待接口接入</text>
          </view>

          <Empty v-else title="还没有餐厅" description="创建或加入餐厅后，成员、菜谱和采购都会跟随餐厅管理。" />

          <view class="quick-grid">
            <view
              v-for="item in restaurantActions"
              :key="item.title"
              class="quick-entry"
              hover-class="quick-entry--hover"
              hover-stay-time="100"
              @click="navigateTo(item.url)"
            >
              <text class="quick-entry__title">{{ item.title }}</text>
              <text class="quick-entry__description">{{ item.description }}</text>
            </view>
          </view>
        </view>

        <view class="theme-section">
          <view class="section-heading">
            <text class="section-heading__title">外观</text>
          </view>
          <text class="theme-section__description">先选整体皮肤，再在支持的皮肤里切换色系。</text>

          <view class="setting-group">
            <text class="setting-label">皮肤风格</text>
            <view class="option-row">
              <view
                v-for="option in skinOptions"
                :key="option.value"
                class="option-chip"
                :class="{ 'option-chip--active': option.value === effectiveSkin }"
                hover-class="option-chip--hover"
                hover-stay-time="100"
                @click="handleSkinChange(option.value)"
              >
                <text class="option-chip__text">{{ option.label }}</text>
                <text v-if="option.access === 'member'" class="option-chip__badge">会员</text>
              </view>
            </view>
          </view>

          <view v-if="canSwitchPalette" class="setting-group">
            <text class="setting-label">色系</text>
            <view class="option-row">
              <view
                v-for="palette in supportedPalettes"
                :key="palette"
                class="option-chip"
                :class="{ 'option-chip--active': palette === effectivePalette }"
                hover-class="option-chip--hover"
                hover-stay-time="100"
                @click="handlePaletteChange(palette)"
              >
                <text class="option-chip__text">{{ paletteLabels[palette] }}</text>
              </view>
            </view>
          </view>

          <text v-else class="setting-note">当前皮肤使用固定色系。</text>
        </view>
      </template>
    </view>
  </Layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { restaurantApi } from "@/apis/restaurant";
import { useTheme } from "@/composables/useTheme";
import { useRestaurantStore } from "@/stores/restaurant";
import { useSessionStore } from "@/stores/session";
import { THEME_SKIN_OPTIONS, type ThemePalette, type ThemeSkin } from "@/themes";

const sessionStore = useSessionStore();
const restaurantStore = useRestaurantStore();
const {
  themeClasses,
  effectiveSkin,
  effectivePalette,
  supportedPalettes,
  canSwitchPalette,
  setThemeSkin,
  setThemePalette
} = useTheme();
const profileLoading = ref(false);
const skinOptions = THEME_SKIN_OPTIONS;
const restaurantCount = computed(() => restaurantStore.restaurants.length);

const paletteLabels: Record<ThemePalette, string> = {
  default: "默认",
  warm: "暖黄",
  olive: "橄榄",
  cool: "冷蓝"
};

const restaurantActions = [
  {
    title: "创建餐厅",
    description: "建立自己的家庭餐桌",
    url: "/pages_restaurant/create/index"
  },
  {
    title: "成员管理",
    description: "邀请家人一起点菜",
    url: "/pages_restaurant/members/index"
  },
  {
    title: "餐厅设置",
    description: "维护偏好和基础信息",
    url: "/pages_restaurant/settings/index"
  }
];

async function loadMe() {
  if (!sessionStore.isLoggedIn || profileLoading.value) return;

  profileLoading.value = true;
  try {
    const result = await restaurantApi.listMine();
    restaurantStore.setRestaurants(result.restaurants, result.currentRestaurantId);
  } finally {
    profileLoading.value = false;
  }
}

async function handleSkinChange(skin: ThemeSkin) {
  await setThemeSkin(skin);
}

async function handlePaletteChange(palette: ThemePalette) {
  await setThemePalette(palette);
}

function navigateTo(url: string) {
  uni.navigateTo({ url });
}
</script>

<style scoped lang="scss">
.me-page {
  padding-bottom: var(--space-md);
}

.me-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.profile-card {
  display: flex;
  align-items: center;
  min-height: 150rpx;
  padding: 28rpx;
  border-radius: var(--entry-board-radius);
  background: var(--entry-board-bg);
  box-shadow: var(--entry-board-shadow);
}

.profile-card__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border: var(--entry-illustration-border-width) solid var(--entry-outline);
  border-radius: var(--radius-pill);
  background: var(--entry-primary-bg);
}

.profile-card__avatar-skeleton {
  flex: 0 0 112rpx;
  width: 112rpx;
}

.profile-card__avatar-text {
  color: var(--entry-ink);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heavy);
}

.profile-card__main {
  flex: 1;
  min-width: 0;
  margin-left: var(--space-md);
}

.profile-card__name,
.profile-card__meta {
  display: block;
}

.profile-card__name {
  color: var(--entry-ink);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.profile-card__meta {
  overflow: hidden;
  margin-top: 8rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-card__action {
  flex: 0 0 auto;
  padding: 14rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--entry-button-bg);
}

.profile-card__action--hover,
.quick-entry--hover,
.option-chip--hover {
  opacity: 0.86;
}

.profile-card__action-text {
  color: var(--entry-button-color);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.login-card,
.restaurant-panel,
.theme-section {
  margin-top: var(--space-md);
}

.login-card {
  margin-top: 0;
}

.restaurant-panel,
.theme-section {
  padding: var(--space-lg);
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-heading__title {
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.section-heading__action {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.restaurant-card {
  margin-top: var(--space-md);
  padding: 26rpx;
  border-radius: var(--entry-card-radius);
  background: var(--color-surface-muted);
}

.restaurant-card__name,
.restaurant-card__meta {
  display: block;
}

.restaurant-card__name {
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.restaurant-card__meta {
  margin-top: 8rpx;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.quick-entry {
  min-height: 132rpx;
  padding: 22rpx;
  border-radius: var(--radius-lg);
  background: var(--entry-board-bg);
}

.quick-entry__title,
.quick-entry__description {
  display: block;
}

.quick-entry__title {
  color: var(--entry-ink);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.quick-entry__description {
  margin-top: 8rpx;
  color: var(--entry-muted-text);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.theme-section__description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

.setting-group {
  margin-top: var(--space-lg);
}

.setting-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  margin: 16rpx -8rpx -8rpx;
}

.option-chip {
  display: flex;
  align-items: center;
  margin: 0 8rpx 8rpx;
  padding: 16rpx 22rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
}

.option-chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.option-chip__text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.option-chip--active .option-chip__text {
  color: var(--color-text-inverse);
}

.option-chip__badge {
  margin-left: 8rpx;
  padding: 2rpx 8rpx;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
}

.option-chip--active .option-chip__badge {
  background: rgba(255, 255, 255, 0.22);
  color: var(--color-text-inverse);
}

.setting-note {
  display: block;
  margin-top: var(--space-lg);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
}
</style>
