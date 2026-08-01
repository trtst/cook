<template>
  <view class="recipe-search-loading" :class="rootClass" :style="rootStyle">
    <view v-if="visible" class="recipe-search-loading__inner">
      <image
        v-if="showSpinner"
        class="recipe-search-loading__art"
        :src="cookingLoadingGif"
        mode="aspectFit"
      />
      <text class="recipe-search-loading__text">{{ currentText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import cookingLoadingGif from "@/assets/recipe-page/cooking-loading.gif";

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
  background: var(--color-page);
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

.recipe-search-loading__text {
  color: var(--color-text-tertiary);
  font-size: 22rpx;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
