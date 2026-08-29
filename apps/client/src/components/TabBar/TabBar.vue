<template>
  <view class="tabbar-shell" :class="`tabbar-shell--${effectiveSkin}`">
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
        </view>
        <text class="tabbar__label">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { TAB_ITEMS, type TabKey } from "./tabs";
import { uniPlatform } from "@/platform/uni";
import { useTheme } from "@/composables/useTheme";
import { FALLBACK_ASSET_SKIN, getThemeSkinAssets, type ThemeTabbarIconName } from "@/themes";

const props = withDefaults(
  defineProps<{
    current: TabKey;
    interactive?: boolean;
  }>(),
  {
    interactive: true
  }
);

const { effectiveSkin } = useTheme();
const activeIndex = computed(() => Math.max(TAB_ITEMS.findIndex(item => item.key === props.current), 0));
const activePillStyle = computed(() => ({
  transform: `translateX(calc(${activeIndex.value} * 100%))`
}));

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
</script>

<style scoped lang="scss">
.tabbar-shell {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 900;
  height: calc(var(--tabbar-shell-height) + env(safe-area-inset-bottom));
  pointer-events: none;
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
  color: var(--color-text-tertiary);
}

.tabbar__item--hover {
  opacity: 0.86;
}

.tabbar__item--active {
  color: var(--color-text);
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
  color: var(--color-text-tertiary);
  line-height: 1;
  text-align: center;
}

.tabbar__label {
  position: relative;
  z-index: 1;
  overflow: hidden;
  max-width: 120rpx;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabbar__item--active .tabbar__label {
  color: var(--color-text);
}

.tabbar__item--active .tabbar__font-icon {
  color: var(--color-text);
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
