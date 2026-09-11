<template>
  <view class="recipe-search-loading" :class="rootClass" :style="rootStyle">
    <view v-if="visible" class="recipe-search-loading__inner">
      <view
        v-if="showSpinner"
        class="recipe-search-loading__art"
      >
        <view class="recipe-search-loading__loader">
          <view class="recipe-search-loading__pan-wrapper">
            <view class="recipe-search-loading__pan">
              <view class="recipe-search-loading__food" />
              <view class="recipe-search-loading__pan-base" />
              <view class="recipe-search-loading__pan-handle" />
            </view>
            <view class="recipe-search-loading__pan-shadow" />
          </view>
        </view>
      </view>
      <text class="recipe-search-loading__text">{{ currentText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

function pickText(source: string | string[]) {
  if (Array.isArray(source)) {
    if (!source.length) return "";
    return source[Math.floor(Math.random() * source.length)] || "";
  }
  return source;
}

const props = withDefaults(
  defineProps<{
    pullDistance?: number;
    refreshing?: boolean;
    showSuccess?: boolean;
    refresherText?: string;
    threshold?: number;
    loading?: boolean;
    loadingText?: string | string[];
    mode?: "overlay" | "block";
  }>(),
  {
    pullDistance: 0,
    refreshing: false,
    showSuccess: false,
    refresherText: "",
    threshold: 88,
    loading: false,
    loadingText: "加载中...",
    mode: "overlay"
  }
);

const currentLoadingText = ref(pickText(props.loadingText));

watch(
  () => props.loading,
  (loading, previous) => {
    if (loading && !previous) {
      currentLoadingText.value = pickText(props.loadingText);
    }
  },
  { immediate: true }
);

const currentText = computed(() => {
  if (props.showSuccess) return props.refresherText;
  if (props.loading) return currentLoadingText.value;
  return props.refresherText;
});

const visible = computed(
  () => props.loading || props.pullDistance > 0 || props.refreshing || props.showSuccess
);

const showRefresherArt = computed(
  () => !props.showSuccess && (props.refreshing || props.pullDistance >= props.threshold)
);

const height = computed(() => {
  if (props.loading || props.refreshing || props.showSuccess) return props.threshold;
  return props.pullDistance;
});

const rootStyle = computed(() => ({
  height: `${height.value}px`,
  opacity: visible.value ? 1 : 0
}));

const showSpinner = computed(() => props.loading || showRefresherArt.value);
const rootClass = computed(() => ({
  "recipe-search-loading--block": props.mode === "block"
}));
</script>

<style scoped lang="scss">
.recipe-search-loading {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  background: transparent;
  transition: opacity 180ms ease;
}

.recipe-search-loading--block {
  position: relative;
  top: auto;
  right: auto;
  left: auto;
  z-index: 0;
}

.recipe-search-loading__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 100%;
  padding: 0 24rpx;
}

.recipe-search-loading__art {
  width: 44rpx;
  height: 44rpx;
  flex-shrink: 0;
}

.recipe-search-loading__loader {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
}

.recipe-search-loading__pan-wrapper {
  position: relative;
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: flex-start;
  justify-content: flex-end;
  flex-direction: column;
  gap: 4rpx;
}

.recipe-search-loading__pan {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: flex-start;
  animation: recipe-search-loading-cooking 1.7s infinite;
}

.recipe-search-loading__food {
  position: absolute;
  z-index: 2;
  width: 40%;
  height: 1rpx;
  left: 2rpx;
  border-radius: 50%;
  background: linear-gradient(to bottom, rgb(82, 33, 33), rgb(200, 106, 106));
  animation: recipe-search-loading-flip 1.7s infinite;
}

.recipe-search-loading__pan-base {
  z-index: 3;
  width: 50%;
  height: 5rpx;
  border-bottom-right-radius: 9rpx;
  border-bottom-left-radius: 9rpx;
  background: linear-gradient(to top, rgb(3, 156, 156), rgb(10, 191, 191));
}

.recipe-search-loading__pan-handle {
  width: 40%;
  height: 2rpx;
  border-radius: 2rpx;
  background: linear-gradient(to bottom, rgb(18, 18, 18), rgb(74, 74, 74));
}

.recipe-search-loading__pan-shadow {
  width: 15rpx;
  height: 2rpx;
  margin-left: 3rpx;
  border-radius: 2rpx;
  background-color: rgba(0, 0, 0, 0.21);
  filter: blur(1rpx);
  animation: recipe-search-loading-shadow 1.7s infinite;
}

@keyframes recipe-search-loading-cooking {
  0% {
    transform: rotate(0deg);
    transform-origin: top right;
  }

  10% {
    transform: rotate(-4deg);
    transform-origin: top right;
  }

  50% {
    transform: rotate(20deg);
  }

  100% {
    transform: rotate(0deg);
  }
}

@keyframes recipe-search-loading-flip {
  0% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-22rpx) rotate(180deg);
  }

  100% {
    transform: translateY(0) rotate(360deg);
  }
}

@keyframes recipe-search-loading-shadow {
  0% {
    transform: scaleX(0.7);
  }

  50% {
    transform: scaleX(1);
  }

  100% {
    transform: scaleX(0.7);
  }
}

.recipe-search-loading__text {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
