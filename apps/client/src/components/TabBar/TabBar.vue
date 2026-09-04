<template>
  <view class="tabbar-shell" :class="[`tabbar-shell--${effectiveSkin}`, { 'tabbar-shell--embedded': !fixed }]">
    <view class="tabbar">
      <view class="tabbar__active-pill" :style="activePillStyle" />
      <view
        v-for="item in TAB_ITEMS"
        :key="item.key"
        class="tabbar__item"
        :class="{ 'tabbar__item--active': item.key === current }"
        :hover-class="interactive ? 'tabbar__item--hover' : 'none'"
        hover-stay-time="100"
        @click="switchTab(item.pagePath)"
      >
        <view class="tabbar__icon-wrap">
          <image
            v-if="getTabbarAsset(item.iconName)?.type === 'svg'"
            class="tabbar__icon"
            :src="getSvgIconPath(item.iconName, item.key === current)"
            mode="aspectFit"
          />
          <text
            v-else
            class="tabbar__font-icon cookfont"
            :class="getFontIconClass(item.iconName)"
            aria-hidden="true"
          />
          <text v-if="item.key === 'me' && badgeSnapshot.unreadCount > 0" class="tabbar__badge">{{ badgeText }}</text>
          <view v-else-if="item.key === 'me' && badgeSnapshot.showReminderDot" class="tabbar__dot" />
        </view>
        <text class="tabbar__label">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { TAB_ITEMS, type TabKey } from "./tabs";
import { uniPlatform } from "@/platform/uni";
import { useTheme } from "@/composables/useTheme";
import {
  EMPTY_BADGE_SNAPSHOT,
  notificationBadgeState,
  readNotificationBadgeSnapshot,
  refreshNotificationBadgeSnapshot,
  writeNotificationBadgeSnapshot
} from "@/services/notification-badge";
import { FALLBACK_ASSET_SKIN, getThemeSkinAssets, type ThemeTabbarIconName } from "@/themes";
import { useSessionStore } from "@/stores/session";

const props = withDefaults(
  defineProps<{
    current: TabKey;
    interactive?: boolean;
    fixed?: boolean;
  }>(),
  {
    interactive: true,
    fixed: true
  }
);

const { effectiveSkin } = useTheme();
const sessionStore = useSessionStore();
const activeIndex = computed(() => Math.max(TAB_ITEMS.findIndex(item => item.key === props.current), 0));
const activePillStyle = computed(() => ({
  transform: `translateX(calc(${activeIndex.value} * 100%))`
}));
const badgeSnapshot = computed(() => notificationBadgeState.value);
const badgeText = computed(() => (badgeSnapshot.value.unreadCount > 99 ? "99+" : String(badgeSnapshot.value.unreadCount)));

onShow(() => {
  void syncBadgeSnapshot();
});

function getTabbarAsset(iconName: ThemeTabbarIconName) {
  const currentAsset = getThemeSkinAssets(effectiveSkin.value).tabbar?.[iconName];
  const fallbackAsset = getThemeSkinAssets(FALLBACK_ASSET_SKIN).tabbar?.[iconName];

  return currentAsset ?? fallbackAsset;
}

function getSvgIconPath(iconName: ThemeTabbarIconName, active: boolean) {
  const asset = getTabbarAsset(iconName);

  if (asset?.type !== "svg") return "";
  return active ? asset.active : asset.default;
}

function getFontIconClass(iconName: ThemeTabbarIconName) {
  const asset = getTabbarAsset(iconName);

  if (asset?.type !== "icon") return "";
  return asset.className;
}

function switchTab(pagePath: string) {
  if (!props.interactive) return;
  void uniPlatform.navigation.switchTab(pagePath);
}

async function syncBadgeSnapshot() {
  readNotificationBadgeSnapshot();

  if (!sessionStore.isLoggedIn) {
    writeNotificationBadgeSnapshot(EMPTY_BADGE_SNAPSHOT);
    return;
  }
  await refreshNotificationBadgeSnapshot().catch(() => null);
}
</script>

<style scoped lang="scss">
.tabbar-shell {
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 900;
  height: calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));
  pointer-events: none;
}

.tabbar-shell:not(.tabbar-shell--embedded) {
  position: fixed;
}

.tabbar-shell--embedded {
  position: relative;
}

.tabbar-shell::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--material-tabbar-bg);
  -webkit-mask-image: var(--frosted-mask-image);
  mask-image: var(--frosted-mask-image);
  -webkit-backdrop-filter: var(--material-mask-filter);
  backdrop-filter: var(--material-mask-filter);
  content: "";
}

.tabbar {
  position: absolute;
  right: 28rpx;
  bottom: calc(var(--tabbar-bottom-gap) + env(safe-area-inset-bottom));
  left: 28rpx;
  z-index: 1;
  display: flex;
  height: var(--tabbar-panel-height);
  padding: 10rpx;
  border-radius: var(--radius-pill);
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  pointer-events: auto;
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
}

.tabbar-shell--embedded .tabbar {
  right: 0;
  bottom: env(safe-area-inset-bottom);
  left: 0;
}

.tabbar__active-pill {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  z-index: 0;
  width: calc((100% - 20rpx) / 3);
  height: 88rpx;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  transition: transform 0.22s ease;
  backdrop-filter: var(--material-tabbar-filter);
}

.tabbar__item {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-width: 0;
  height: 88rpx;
  border-radius: var(--radius-pill);
  color: var(--color-text);
}

.tabbar__item--hover {
  opacity: 0.86;
}

.tabbar__item--active {
  color: var(--color-icon-active);
}

.tabbar__icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  margin-bottom: 4rpx;
}

.tabbar__badge,
.tabbar__dot {
  position: absolute;
  top: -5rpx;
  left: 40rpx;
  z-index: 2;
}

.tabbar__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: var(--color-state-danger-base);
  color: var(--notification-badge-text);
  font-size: 20rpx;
  font-weight: var(--font-weight-bold);
  line-height: 1;
}

.tabbar__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--color-state-danger-base);
  box-shadow: 0 0 0 4rpx var(--material-tabbar-bg);
}

.tabbar__icon {
  width: 38rpx;
  height: 38rpx;
}

.tabbar__font-icon {
  display: block;
  color: var(--color-text);
  line-height: 1;
  text-align: center;
}

.tabbar__label {
  position: relative;
  z-index: 1;
  overflow: hidden;
  max-width: 120rpx;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabbar__item--active .tabbar__label {
  color: var(--color-icon-active);
}

.tabbar__item--active .tabbar__font-icon {
  color: var(--color-icon-active);
}

.tabbar-shell--default .tabbar__icon-wrap,
.tabbar-shell--default .tabbar__icon {
  width: 44rpx;
  height: 44rpx;
}

.tabbar-shell--default .tabbar__label {
  font-size: 24rpx;
  font-weight: normal;
}

.tabbar-shell--default .tabbar__item--active .tabbar__label {
  font-weight: var(--font-weight-heavy);
}
</style>
