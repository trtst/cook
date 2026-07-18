<template>
  <view class="tabbar-shell">
    <view class="tabbar">
      <view
        v-for="item in TAB_ITEMS"
        :key="item.key"
        class="tabbar__item"
        :class="{ 'tabbar__item--active': item.key === current }"
        hover-class="tabbar__item--hover"
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
            class="tabbar__font-icon cookFont"
            :class="getFontIconClass(item.iconName)"
            aria-hidden="true"
          />
        </view>
        <text class="tabbar__label">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { TAB_ITEMS, type TabKey } from "./tabs";
import { useTheme } from "@/composables/useTheme";
import { FALLBACK_ASSET_SKIN, getThemeSkinAssets, type ThemeTabbarIconName } from "@/themes";

defineProps<{
  current: TabKey;
}>();

const { effectiveSkin } = useTheme();

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

  if (asset?.type !== "font") return "";
  return asset.className;
}

function switchTab(pagePath: string) {
  uni.switchTab({
    url: pagePath
  });
}
</script>

<style scoped lang="scss">
.tabbar-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 900;
  height: calc(152rpx + env(safe-area-inset-bottom));
  pointer-events: none;
}

.tabbar-shell::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--color-tabbar-bg);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 36%, rgba(0, 0, 0, 1) 100%);
  mask-image: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.1) 36%, rgba(0, 0, 0, 1) 100%);
  -webkit-backdrop-filter: saturate(180%) blur(22rpx);
  backdrop-filter: saturate(180%) blur(22rpx);
  content: "";
}

.tabbar {
  position: absolute;
  right: 28rpx;
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  left: 28rpx;
  z-index: 1;
  display: flex;
  height: 108rpx;
  padding: 10rpx;
  border: 1rpx solid var(--color-border);
  border-radius: 999rpx;
  background: var(--color-tabbar-bg);
  pointer-events: auto;
  -webkit-backdrop-filter: saturate(180%) blur(28rpx);
  backdrop-filter: saturate(180%) blur(28rpx);
}

.tabbar__item {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  min-width: 0;
  height: 88rpx;
  border-radius: 999rpx;
  color: var(--color-text-tertiary);
}

.tabbar__item--hover {
  opacity: 0.86;
}

.tabbar__item--active {
  background: var(--color-surface-muted);
  color: var(--entry-ink);
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

.tabbar__icon {
  width: 38rpx;
  height: 38rpx;
}

.tabbar__font-icon {
  display: block;
  width: 38rpx;
  height: 38rpx;
  color: var(--color-text-tertiary);
  font-size: 38rpx;
  line-height: 38rpx;
  text-align: center;
}

.tabbar__label {
  position: relative;
  z-index: 1;
  overflow: hidden;
  max-width: 120rpx;
  font-size: var(--font-size-sm);
  font-weight: var(--entry-subtitle-weight);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabbar__item--active .tabbar__label {
  color: var(--entry-ink);
}

.tabbar__item--active .tabbar__font-icon {
  color: var(--entry-ink);
}
</style>
