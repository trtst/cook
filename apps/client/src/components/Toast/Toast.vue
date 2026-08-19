<template>
  <view v-if="toast.visible" class="toast-layer" :style="layerStyle">
    <view class="toast-shell">
      <view class="toast-card" :class="[`toast-card--${toast.phase}`, `toast-card--${toast.tone}`]">
        <view class="toast-card__glow" />
        <view class="toast-card__body">
          <text class="toast-card__title">{{ toast.title }}</text>
          <text v-if="toast.content" class="toast-card__content">{{ toast.content }}</text>
        </view>
        <view class="toast-card__line" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useToastState } from "@/feedback/toast";
import { uniPlatform } from "@/platform/uni";

const props = withDefaults(
  defineProps<{
    topOffset?: number;
  }>(),
  {
    topOffset: 0
  }
);

const toast = useToastState();

const layerStyle = computed(() => {
  const statusBarHeight = uniPlatform.system.getWindowInfo()?.statusBarHeight ?? 0;
  const topOffset = Math.max(props.topOffset, statusBarHeight);
  return {
    paddingTop: `calc(${topOffset}px + 18rpx)`
  };
});
</script>

<style scoped lang="scss">
.toast-layer {
  position: fixed;
  inset: 0;
  z-index: 1600;
  pointer-events: none;
}

.toast-shell {
  display: flex;
  justify-content: center;
  padding: 0 var(--space-page);
}

.toast-card {
  display: inline-block;
  position: relative;
  overflow: hidden;
  width: auto;
  max-width: 80vw;
  border: 1rpx solid var(--color-border);
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
  background: linear-gradient(180deg, var(--color-tabbar-bg) 0%, var(--color-surface-mask-strong) 100%);
  box-shadow: var(--shadow-floating);
  // -webkit-backdrop-filter: blur(18rpx) saturate(145%);
  // backdrop-filter: blur(18rpx) saturate(145%);
  opacity: 0;
  transform: translate3d(0, -18rpx, 0) scale(0.98);
  transition: opacity 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
}

.toast-card--shown {
  opacity: 1;
  transform: translate3d(0, 0, 0) scale(1);
}

.toast-card--leave,
.toast-card--enter {
  opacity: 0;
}

.toast-card--leave {
  transform: translate3d(0, -10rpx, 0) scale(0.98);
  transition-duration: 180ms;
}

.toast-card__glow {
  position: absolute;
  top: -28rpx;
  right: -30rpx;
  width: 252rpx;
  height: 126rpx;
  border-radius: 0 0 0 126rpx;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--color-primary-soft) 100%);
  opacity: 0.86;
}

.toast-card--error .toast-card__glow {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, var(--color-danger-soft) 100%);
}

.toast-card__body {
  position: relative;
  z-index: 1;
  padding: 28rpx 28rpx 26rpx;
}

.toast-card__title {
  display: block;
  color: var(--color-text);
  font-size: 28rpx;
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  word-break: break-all;
}

.toast-card__content {
  display: block;
  margin-top: 10rpx;
  color: var(--color-text-secondary);
  font-size: 22rpx;
  line-height: var(--line-height-normal);
  word-break: break-all;
}

.toast-card__line {
  height: 8rpx;
  background: linear-gradient(90deg, var(--color-primary) 0%, var(--theme-accent) 100%);
}

.toast-card--error .toast-card__line {
  background: linear-gradient(90deg, var(--color-danger) 0%, #f6ab62 100%);
}
</style>
