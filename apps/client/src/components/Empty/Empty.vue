<template>
  <view class="empty-state">
    <text class="empty-state__title">{{ title }}</text>
    <text v-if="description" class="empty-state__description">{{ description }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<style scoped lang="scss">
.empty-state {
  padding: 48rpx 32rpx;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.empty-state__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-lg);
  font-weight: 600;
}

.empty-state__description {
  display: block;
  margin-top: var(--space-sm);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}
</style>
