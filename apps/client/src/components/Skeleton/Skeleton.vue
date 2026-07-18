<template>
  <view class="skeleton" :class="[`skeleton--${layout}`, { 'skeleton--animated': animated }]">
    <view
      v-for="item in count"
      :key="item"
      class="skeleton__item"
      :class="`skeleton__item--${shape}`"
      :style="itemStyle"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    count?: number;
    layout?: "row" | "column";
    shape?: "rect" | "circle";
    width?: string;
    height?: string;
    radius?: string;
    animated?: boolean;
  }>(),
  {
    count: 1,
    layout: "row",
    shape: "rect",
    width: "160rpx",
    height: "120rpx",
    radius: "var(--radius-md)",
    animated: true
  }
);

const itemStyle = computed(() => ({
  width: props.width,
  height: props.height,
  borderRadius: props.shape === "circle" ? "var(--radius-pill)" : props.radius
}));
</script>

<style scoped lang="scss">
.skeleton {
  display: flex;
  width: 100%;
  gap: var(--space-md);
}

.skeleton--row {
  flex-direction: row;
}

.skeleton--column {
  flex-direction: column;
  align-items: stretch;
}

.skeleton__item {
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-surface-muted);
}

.skeleton--column .skeleton__item {
  flex-shrink: 1;
}

.skeleton--animated .skeleton__item::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.42) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  content: "";
}

.theme-dark .skeleton--animated .skeleton__item::after {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.14) 50%, transparent 100%);
}

@keyframes skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>
