<template>
  <view class="navbar">
    <view
      class="navbar__fixed"
      :class="{ 'navbar__fixed--static': !fixed, 'navbar__fixed--transparent': transparent }"
      :style="fixedStyle"
    >
      <view class="navbar__status" :style="statusStyle" />
      <view class="navbar__inner" :style="innerStyle">
        <view class="navbar__side">
          <view
            v-if="showLeft"
            class="navbar__icon-button"
            hover-class="navbar__icon-button--hover"
            hover-stay-time="100"
            @click="handleLeftClick"
          >
            <text class="navbar__icon">{{ canGoBack ? "<" : "⌂" }}</text>
          </view>
          <slot v-else name="left" />
        </view>

        <view class="navbar__center">
          <slot>
            <text class="navbar__title">{{ title }}</text>
          </slot>
        </view>

        <view class="navbar__side navbar__side--right">
          <slot name="right" />
        </view>
      </view>
    </view>
    <view v-if="fixed && placeholder" class="navbar__placeholder" :style="placeholderStyle" />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSystemInfo } from "@/composables/useSystemInfo";

withDefaults(
  defineProps<{
    title?: string;
    showLeft?: boolean;
    fixed?: boolean;
    placeholder?: boolean;
    transparent?: boolean;
  }>(),
  {
    title: "",
    showLeft: true,
    fixed: true,
    placeholder: true,
    transparent: false
  }
);

const { navBarHeight, navBarTotalHeight, systemInfo } = useSystemInfo();

const canGoBack = computed(() => getCurrentPages().length > 1);

const fixedStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));

const statusStyle = computed(() => ({
  height: `${systemInfo.value.statusBarHeight}px`
}));

const innerStyle = computed(() => ({
  height: `${navBarHeight.value}px`
}));

const placeholderStyle = computed(() => ({
  height: `${navBarTotalHeight.value}px`
}));

function handleLeftClick() {
  if (canGoBack.value) {
    uni.navigateBack();
    return;
  }

  uni.switchTab({
    url: "/pages/home/index"
  });
}
</script>

<style scoped lang="scss">
.navbar__fixed {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 800;
  overflow: hidden;
  background: var(--color-page);
}

.navbar__fixed--static {
  position: relative;
}

.navbar__fixed--transparent {
  background: transparent;
}

.navbar__inner {
  display: flex;
  align-items: center;
  padding: 0 var(--space-page);
}

.navbar__side {
  display: flex;
  flex: 0 0 96rpx;
  align-items: center;
  min-width: 0;
}

.navbar__side--right {
  justify-content: flex-end;
}

.navbar__center {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.navbar__title {
  overflow: hidden;
  max-width: 420rpx;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navbar__icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
}

.navbar__icon-button--hover {
  background: var(--color-surface-muted);
}

.navbar__icon {
  font-size: var(--font-size-md);
  font-weight: 700;
  line-height: 1;
}
</style>
