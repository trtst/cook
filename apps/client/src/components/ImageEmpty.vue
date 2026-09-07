<template>
  <view class="image-empty" :class="`image-empty--${ratio}`">
    <view class="image-empty__body">
      <text :class="['cookfont', iconClass, 'image-empty__icon']" />
      <text class="image-empty__copy font-medium">{{ copy }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    copy?: string;
    iconClass?: string;
    ratio?: "4-3" | "16-9" | "fill";
  }>(),
  {
    copy: "暂无图片",
    iconClass: "icon-none-image",
    ratio: "4-3"
  }
);
</script>

<style scoped lang="scss">
.image-empty {
  display: flex;
  width: 100%;
  aspect-ratio: 4 / 3;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--page-cover-fresh-bg);
}

.image-empty--16-9 {
  aspect-ratio: 16 / 9;
}

.image-empty--fill {
  height: 100%;
  aspect-ratio: auto;
}

.image-empty__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--color-text-secondary);
  opacity: 0.58;
}

.image-empty__icon {
  color: var(--color-icon-tertiary);
  font-size: 100rpx;
  line-height: 1;
}

.image-empty__copy {
  font-size: 24rpx;
  font-weight: var(--font-weight-medium);
  line-height: 1;
}
</style>
