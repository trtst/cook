<template>
  <view v-if="visible" class="page-loading">
    <view class="page-loading__loader" />
    <text class="page-loading__text">{{ text }}</text>
  </view>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    visible?: boolean;
    text?: string;
  }>(),
  {
    visible: false,
    text: "页面加载中..."
  }
);
</script>

<style scoped lang="scss">
.page-loading {
  position: absolute;
  inset: 0;
  z-index: 1400;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  background: var(--color-page);
}

.page-loading__loader {
  position: relative;
  width: 35px;
  height: 80px;
}

.page-loading__loader::after {
  position: absolute;
  inset: 0;
  padding: 3px 5px;
  border-top: 1px solid var(--color-border);
  border-bottom: 4px solid var(--color-primary);
  background:
    linear-gradient(var(--color-primary) 0 0) bottom no-repeat content-box,
    var(--color-surface-muted);
  mix-blend-mode: darken;
  animation: page-loading-drink 1.5s infinite linear;
  content: "";
}

.page-loading__loader::before {
  position: absolute;
  inset: -18px calc(50% - 2px) 8px;
  background: var(--color-secondary);
  content: "";
  transform: rotate(8deg);
  transform-origin: bottom;
}

.page-loading__text {
  color: var(--color-text-secondary);
  font-size: 24rpx;
}

@keyframes page-loading-drink {
  0% {
    background-size: 100% 100%;
  }

  100% {
    background-size: 100% 5%;
  }
}
</style>
