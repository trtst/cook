<template>
  <button class="share-pill" open-type="share">
    <text class="cookfont icon-share share-pill__icon" />
    <text class="share-pill__text">{{ label }}</text>
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
  }>(),
  {
    label: "分享"
  }
);
</script>

<style scoped lang="scss">
.share-pill {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 18rpx;
  height: 52rpx;
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  line-height: 1;
}

.share-pill::after {
  border: 0;
}

.share-pill__icon {
  font-size: 22rpx;
  line-height: 1;
}

.share-pill__text {
  line-height: 1;
}
</style>
