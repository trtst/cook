<template>
  <!-- 仅在饭局或计划进入灵感页时展示，避免与页面主导航重复。 -->
  <view class="inspiration-return" :style="{ bottom }" @click="$emit('return')">
    <text class="cookfont icon-back inspiration-return__icon" />
    <text class="inspiration-return__label">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  bottom: string;
}>();

defineEmits<{
  return: [];
}>();
</script>

<style scoped lang="scss">
.inspiration-return {
  position: fixed;
  right: 28rpx;
  left: 28rpx;
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  min-height: 88rpx;
  border: 1rpx solid var(--color-border-light);
  border-radius: var(--radius-pill);
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  color: var(--color-text);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
}

.inspiration-return__icon {
  color: var(--color-primary);
  font-size: 30rpx;
}

.inspiration-return__label {
  font-size: 28rpx;
  font-weight: 600;
}
</style>
