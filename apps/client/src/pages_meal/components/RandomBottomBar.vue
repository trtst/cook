<template>
  <view class="bottom-bar">
    <view class="bottom-bar__summary">
      <text class="bottom-bar__title">{{ title }}</text>
      <text class="bottom-bar__desc">{{ description }}</text>
    </view>
    <view class="bottom-bar__actions bottom-bar__actions--single">
      <button class="primary bottom-bar__button" :disabled="planDisabled || loading" @click="emit('createPlan')">
        加入计划
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string;
  description: string;
  loading: boolean;
  planDisabled: boolean;
}>();

const emit = defineEmits<{
  createPlan: [];
}>();
</script>

<style scoped lang="scss">
.bottom-bar {
  margin-top: var(--space-md);
  padding: 24rpx;
  border-radius: var(--radius-lg);
  background: var(--material-tabbar-bg);
  box-shadow: var(--material-tabbar-shadow);
  -webkit-backdrop-filter: var(--material-tabbar-filter);
  backdrop-filter: var(--material-tabbar-filter);
}

.bottom-bar__summary {
  min-width: 0;
}

.bottom-bar__title {
  display: block;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.bottom-bar__desc {
  display: block;
  margin-top: 8rpx;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
}

.bottom-bar__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}

.bottom-bar__actions--single .bottom-bar__button {
  width: 100%;
  flex: 1 1 100%;
}

.bottom-bar__button {
  flex: 1;
  margin: 0;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heavy);
}

.primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.secondary {
  background: var(--color-surface-muted);
  color: var(--color-text);
}
</style>
