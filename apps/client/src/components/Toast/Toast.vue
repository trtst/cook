<template>
  <view v-if="toast.visible" class="toast-layer" :class="`toast-layer--${toast.placement}`" :style="layerStyle">
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
  if (toast.placement === "bottom") {
    return {
      paddingBottom: `calc(env(safe-area-inset-bottom) + 32rpx)`
    };
  }

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
  display: flex;
  box-sizing: border-box;
  pointer-events: none;
}

.toast-layer--top {
  align-items: flex-start;
}

.toast-layer--bottom {
  align-items: flex-end;
}

.toast-shell {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  justify-content: center;
  padding: 0 var(--space-page);
}

.toast-card {
  display: inline-block;
  position: relative;
  overflow: hidden;
  width: auto;
  min-width: 400rpx;
  max-width: 80vw;
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
  background: var(--material-panel-bg);
  box-shadow: var(--material-panel-shadow);
  -webkit-backdrop-filter: var(--material-panel-filter);
  backdrop-filter: var(--material-panel-filter);
  opacity: 0;
  transition: opacity 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
}

.toast-layer--top .toast-card {
  transform: translate3d(0, -18rpx, 0) scale(0.98);
}

.toast-layer--bottom .toast-card {
  transform: translate3d(0, 28rpx, 0) scale(0.98);
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

.toast-layer--bottom .toast-card--leave {
  transform: translate3d(0, 18rpx, 0) scale(0.98);
}

.toast-card__glow {
  position: absolute;
  top: -28rpx;
  right: -30rpx;
  width: 252rpx;
  height: 126rpx;
  border-radius: 0 0 0 126rpx;
  background: linear-gradient(180deg, var(--feedback-glow-start) 0%, var(--feedback-glow-primary-end) 100%);
  opacity: 0.86;
}

.toast-card--error .toast-card__glow {
  background: linear-gradient(180deg, var(--feedback-glow-start) 0%, var(--feedback-glow-danger-end) 100%);
}

.toast-card__body {
  position: relative;
  z-index: 1;
  padding: 28rpx 28rpx 26rpx;
  text-align: center;
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
  background: var(--feedback-line-primary);
}

.toast-card--error .toast-card__line {
  background: var(--feedback-line-danger);
}
</style>
